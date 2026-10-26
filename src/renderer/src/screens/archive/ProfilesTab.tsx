/** Tab "Profile": mehrere Personen verwalten, aktives Profil festlegen. */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ProfileRow } from '@shared/models'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/Panel'
import { TagEditor } from '@/components/ui/TagEditor'
import { ConfirmDialog } from '@/components/ui/Modal'
import { db, mutate, useQuery } from '@/store/db'
import { useApp } from '@/store/app'
import { useArchive } from '@/store/archive'
import { formatDate } from '@/lib/format'
import { MiniButton, RecordPanel, SectionLabel, useAction, useDebounced } from './common'
import { ProfileForm } from './forms'

export function ProfilesTab() {
  const { t } = useTranslation()
  const activeId = useApp((s) => s.settings.activeProfileId)
  const { search, tags, selected, select, creating, setCreating } = useArchive()
  const q = useDebounced(search)
  const all = useQuery(() => db.profiles.list(q), [q]).data ?? []
  const rows = tags.length ? all.filter((p) => tags.every((tg) => p.tags.includes(tg))) : all

  const columns: Column<ProfileRow>[] = [
    {
      key: 'name',
      label: t('fields.name'),
      width: '1.3fr',
      render: (r) => (
        <span className="flex items-center gap-2 text-accent-100">
          {r.id === activeId && <span className="h-1.5 w-1.5 flex-none bg-accent-400 shadow-glow-dot" title={t('archive.activeProfile')} />}
          {r.name}
        </span>
      )
    },
    { key: 'headline', label: t('fields.headline'), width: '1.6fr', render: (r) => <span className="text-[13px] text-accent-300">{r.headline ?? '—'}</span> },
    { key: 'apps', label: t('archive.tabs.applications'), width: '0.7fr', render: (r) => <span className="font-mono text-[12px] text-accent-300">{r.applicationCount}</span> },
    { key: 'docs', label: t('archive.tabs.documents'), width: '0.7fr', render: (r) => <span className="font-mono text-[12px] text-accent-300">{r.documentCount}</span> }
  ]

  return (
    <>
      <DataTable
        columns={columns}
        rows={rows}
        selectedId={selected.profiles}
        onSelect={(r) => select('profiles', r.id)}
        empty={
          <EmptyState title={t('archive.emptyProfiles')} hint={t('archive.emptyProfilesHint')}>
            <button type="button" className="btn btn-primary" onClick={() => setCreating('profiles')}>
              + {t('archive.newProfile')}
            </button>
          </EmptyState>
        }
      />
      <ProfileDetail id={selected.profiles ?? null} onDeleted={() => select('profiles', null)} />
      {creating === 'profiles' && <ProfileForm onClose={() => setCreating(null)} onSaved={(p) => select('profiles', p.id)} />}
    </>
  )
}

function ProfileDetail({ id, onDeleted }: { id: number | null; onDeleted(): void }) {
  const { t } = useTranslation()
  const lang = useApp((s) => s.settings.language)
  const activeId = useApp((s) => s.settings.activeProfileId)
  const updateSettings = useApp((s) => s.updateSettings)
  const run = useAction()
  const p = useQuery(() => (id ? db.profiles.list().then((l) => l.find((x) => x.id === id) ?? null) : Promise.resolve(null)), [id]).data
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (!id || !p) return <RecordPanel id={null} />
  const inUse = p.applicationCount + p.documentCount > 0

  return (
    <RecordPanel
      id={p.id}
      actions={
        <>
          <MiniButton onClick={() => setEditing(true)}>{t('common.edit')}</MiniButton>
          <MiniButton danger onClick={() => setConfirmDelete(true)}>
            {t('common.delete')}
          </MiniButton>
        </>
      }
    >
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-[24px] text-accent-100">{p.name}</h2>
        <span className="text-[13px] text-accent-300">{p.headline ?? '—'}</span>
      </div>
      {p.id === activeId ? (
        <span className="sys-label flex items-center gap-2 text-accent-300">
          <span className="h-1.5 w-1.5 bg-accent-400 shadow-glow-dot" />
          {t('archive.activeProfile')}
        </span>
      ) : (
        <button type="button" className="btn self-start" onClick={() => updateSettings({ activeProfileId: p.id })}>
          {t('archive.setActive')}
        </button>
      )}
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
        {(['email', 'phone', 'address', 'city'] as const).map((k) =>
          p[k] ? (
            <div key={k} className="contents">
              <dt className="text-accent-400">{t(`fields.${k}`)}</dt>
              <dd className="m-0 truncate text-accent-100">{p[k]}</dd>
            </div>
          ) : null
        )}
        {p.birthDate && (
          <>
            <dt className="text-accent-400">{t('fields.birthDate')}</dt>
            <dd className="m-0 text-accent-100">{formatDate(p.birthDate, lang)}</dd>
          </>
        )}
      </dl>
      <div className="grid grid-cols-3 border border-line text-center">
        {[
          [p.applicationCount, t('archive.tabs.applications')],
          [p.documentCount, t('archive.tabs.documents')],
          [p.photoCount, t('archive.tabs.photos')]
        ].map(([n, label], i) => (
          <div key={i} className={`flex flex-col gap-1 p-2.5 ${i > 0 ? 'border-l border-line' : ''}`}>
            <span className="font-heading text-[22px] font-semibold leading-none text-accent-200">{n}</span>
            <span className="text-[10px] uppercase tracking-[0.1em] text-accent-400">{label}</span>
          </div>
        ))}
      </div>
      <div className="mt-auto flex flex-col gap-2 pt-2">
        <SectionLabel>{t('archive.tags')}</SectionLabel>
        <TagEditor tags={p.tags} onChange={(next) => run(() => mutate(() => db.tags.set('profile', p.id, next)))} />
      </div>

      {editing && <ProfileForm initial={p} onClose={() => setEditing(false)} />}
      {confirmDelete && (
        <ConfirmDialog
          title={t('archive.deleteProfile')}
          text={inUse ? t('archive.deleteProfileBlocked') : t('archive.deleteProfileText', { name: p.name })}
          confirmLabel={t('common.delete')}
          danger
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            setConfirmDelete(false)
            const ok = await run(async () => (await mutate(() => db.profiles.remove(p.id)), true), t('archive.deleted'))
            if (ok) {
              if (activeId === p.id) void updateSettings({ activeProfileId: null })
              onDeleted()
            }
          }}
        />
      )}
    </RecordPanel>
  )
}
