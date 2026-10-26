/** Tab "Firmen": Firmenliste + Detail mit Notizen, zugehörigen Bewerbungen und Tags. */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CompanyRow } from '@shared/models'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/Panel'
import { TagEditor } from '@/components/ui/TagEditor'
import { ConfirmDialog } from '@/components/ui/Modal'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { db, mutate, useQuery } from '@/store/db'
import { useArchive } from '@/store/archive'
import { MiniButton, RecordPanel, SectionLabel, useAction, useDebounced } from './common'
import { CompanyForm } from './forms'

export function CompaniesTab() {
  const { t } = useTranslation()
  const { search, tags, selected, select, creating, setCreating } = useArchive()
  const q = useDebounced(search)
  const all = useQuery(() => db.companies.list(q), [q]).data ?? []
  const rows = tags.length ? all.filter((c) => tags.every((tg) => c.tags.includes(tg))) : all

  const columns: Column<CompanyRow>[] = [
    { key: 'name', label: t('archive.columns.company'), width: '1.5fr', render: (r) => <span className="text-accent-100">{r.name}</span> },
    { key: 'industry', label: t('fields.industry'), width: '1fr', render: (r) => <span className="text-[13px] text-accent-300">{r.industry ?? '—'}</span> },
    { key: 'city', label: t('fields.city'), width: '1fr', render: (r) => <span className="text-[13px] text-accent-300">{r.city ?? '—'}</span> },
    { key: 'apps', label: t('archive.tabs.applications'), width: '0.7fr', render: (r) => <span className="font-mono text-[12px] text-accent-300">{r.applicationCount}</span> }
  ]

  return (
    <>
      <DataTable
        columns={columns}
        rows={rows}
        selectedId={selected.companies}
        onSelect={(r) => select('companies', r.id)}
        empty={
          <EmptyState title={t('archive.emptyCompanies')}>
            <button type="button" className="btn btn-primary" onClick={() => setCreating('companies')}>
              + {t('archive.newCompany')}
            </button>
          </EmptyState>
        }
      />
      <CompanyDetail id={selected.companies ?? null} onDeleted={() => select('companies', null)} />
      {creating === 'companies' && <CompanyForm onClose={() => setCreating(null)} onSaved={(c) => select('companies', c.id)} />}
    </>
  )
}

function CompanyDetail({ id, onDeleted }: { id: number | null; onDeleted(): void }) {
  const { t } = useTranslation()
  const run = useAction()
  const { setTab, select } = useArchive()
  const company = useQuery(() => (id ? db.companies.list().then((l) => l.find((c) => c.id === id) ?? null) : Promise.resolve(null)), [id]).data
  const apps = useQuery(() => (id ? db.applications.list({ companyId: id }) : Promise.resolve([])), [id]).data ?? []
  const notes = useQuery(() => (id ? db.notes.list({ companyId: id }) : Promise.resolve([])), [id]).data ?? []
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')

  if (!id || !company) return <RecordPanel id={null} />

  return (
    <RecordPanel
      id={company.id}
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
        <h2 className="m-0 text-[24px] text-accent-100">{company.name}</h2>
        <span className="text-[13px] text-accent-300">{[company.industry, company.city].filter(Boolean).join(' · ') || '—'}</span>
      </div>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
        {(['address', 'website', 'contactName', 'contactEmail'] as const).map((k) =>
          company[k] ? (
            <div key={k} className="contents">
              <dt className="text-accent-400">{t(`fields.${k}`)}</dt>
              <dd className="m-0 truncate text-accent-100">{company[k]}</dd>
            </div>
          ) : null
        )}
      </dl>

      <div className="flex flex-col gap-2">
        <SectionLabel>{t('archive.tabs.applications')}</SectionLabel>
        {apps.length === 0 && <span className="text-[12px] text-accent-500">—</span>}
        {apps.map((a) => (
          <button
            key={a.id}
            type="button"
            className="flex items-center gap-2 text-left text-[13px] text-accent-200 hover:text-accent-100"
            onClick={() => {
              setTab('applications')
              select('applications', a.id)
            }}
          >
            <span className="flex-1 truncate">{a.role}</span>
            <StatusBadge status={a.status} />
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <SectionLabel>{t('archive.notes')}</SectionLabel>
        {notes.map((n) => (
          <div key={n.id} className="group flex gap-2 border-l border-accent-400 pl-3 text-[13px] text-accent-200">
            <p className="m-0 flex-1 whitespace-pre-wrap">{n.body}</p>
            <button type="button" aria-label={t('common.delete')} className="self-start text-accent-500 opacity-0 hover:text-danger group-hover:opacity-100" onClick={() => run(() => mutate(() => db.notes.remove(n.id)))}>
              ×
            </button>
          </div>
        ))}
        <textarea
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          onKeyDown={async (e) => {
            if (e.key === 'Enter' && !e.shiftKey && noteDraft.trim()) {
              e.preventDefault()
              const ok = await run(() => mutate(() => db.notes.create({ companyId: company.id, body: noteDraft })))
              if (ok) setNoteDraft('')
            }
          }}
          placeholder={t('archive.addNote')}
          rows={2}
          className="input min-h-0 resize-none text-[13px]"
        />
      </div>

      <div className="mt-auto flex flex-col gap-2 pt-2">
        <SectionLabel>{t('archive.tags')}</SectionLabel>
        <TagEditor tags={company.tags} onChange={(next) => run(() => mutate(() => db.tags.set('company', company.id, next)))} />
      </div>

      {editing && <CompanyForm initial={company} onClose={() => setEditing(false)} />}
      {confirmDelete && (
        <ConfirmDialog
          title={t('archive.deleteCompany')}
          text={company.applicationCount > 0 ? t('archive.deleteCompanyBlocked') : t('archive.deleteCompanyText', { name: company.name })}
          confirmLabel={t('common.delete')}
          danger
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            setConfirmDelete(false)
            const ok = await run(async () => (await mutate(() => db.companies.remove(company.id)), true), t('archive.deleted'))
            if (ok) onDeleted()
          }}
        />
      )}
    </RecordPanel>
  )
}
