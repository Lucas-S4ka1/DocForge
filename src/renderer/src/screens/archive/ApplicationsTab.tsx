/**
 * Tab "Bewerbungen": Tabelle wie im Design + Detail-Panel mit Terminen, Dokumenten,
 * Notizen, Tags und Statuswechsel.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { applicationStatuses, type ApplicationRow, type EventItem } from '@shared/models'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/Panel'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { TagEditor } from '@/components/ui/TagEditor'
import { ConfirmDialog } from '@/components/ui/Modal'
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown'
import { db, mutate, useQuery } from '@/store/db'
import { useApp } from '@/store/app'
import { useArchive } from '@/store/archive'
import { formatDate, formatDateTime } from '@/lib/format'
import { openInEditor } from '@/lib/newDocument'
import { requestCreate } from '@/lib/requestCreate'
import { MiniButton, RecordPanel, SectionLabel, useAction, useDebounced } from './common'
import { ApplicationForm, EventForm } from './forms'

export function ApplicationsTab() {
  const { t } = useTranslation()
  const lang = useApp((s) => s.settings.language)
  const { search, statuses, profileId, tags, selected, select, creating, setCreating } = useArchive()
  const q = useDebounced(search)

  const { data: rows = [] } = useQuery(
    () => db.applications.list({ search: q, statuses, profileId, tags }),
    [q, statuses.join(), profileId, tags.join()]
  )
  const selectedId = selected.applications ?? null

  const docLabel = (r: ApplicationRow) =>
    [...r.documents.map((d) => `${t(`docShort.${d.type}`)} v${d.version}`), ...(r.photoCount ? [t('docShort.photo')] : [])].join(' · ') || '—'

  const columns: Column<ApplicationRow>[] = [
    { key: 'company', label: t('archive.columns.company'), width: '1.25fr', render: (r) => <span className="text-accent-100">{r.companyName}</span> },
    { key: 'role', label: t('archive.columns.role'), width: '1.35fr', render: (r) => <span className="text-accent-200">{r.role}</span> },
    { key: 'docs', label: t('archive.columns.documents'), width: '1.1fr', render: (r) => <span className="text-[13px] text-accent-300">{docLabel(r)}</span> },
    { key: 'status', label: t('archive.columns.status'), width: '0.75fr', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'updated', label: t('archive.columns.updated'), width: '0.6fr', render: (r) => <span className="text-[13px] text-accent-300">{formatDate(r.updatedAt, lang)}</span> }
  ]

  return (
    <>
      <DataTable
        columns={columns}
        rows={rows}
        selectedId={selectedId}
        onSelect={(r) => select('applications', r.id)}
        empty={
          <EmptyState title={t('archive.emptyApplications')} hint={t('archive.emptyApplicationsHint')}>
            <button type="button" className="btn btn-primary" onClick={() => setCreating('applications')}>
              + {t('archive.newApplication')}
            </button>
          </EmptyState>
        }
      />
      <ApplicationDetail id={selectedId} onDeleted={() => select('applications', null)} />
      {creating === 'applications' && <ApplicationForm onClose={() => setCreating(null)} onSaved={(a) => select('applications', a.id)} />}
    </>
  )
}

function ApplicationDetail({ id, onDeleted }: { id: number | null; onDeleted(): void }) {
  const { t } = useTranslation()
  const lang = useApp((s) => s.settings.language)
  const run = useAction()
  const row = useQuery(() => (id ? db.applications.getRow(id) : Promise.resolve(null)), [id]).data
  const notes = useQuery(() => (id ? db.notes.list({ applicationId: id }) : Promise.resolve([])), [id]).data ?? []
  const events = useQuery(() => (id ? db.events.list(id) : Promise.resolve([])), [id]).data ?? []
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [eventForm, setEventForm] = useState<EventItem | 'new' | null>(null)
  const [noteDraft, setNoteDraft] = useState('')

  if (!id || !row) return <RecordPanel id={null} />

  const interview = events.find((e) => e.kind === 'interview')

  return (
    <RecordPanel
      id={row.id}
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
        <h2 className="m-0 text-[24px] text-accent-100">{row.companyName}</h2>
        <span className="text-[13px] text-accent-300">{[row.role, row.location ?? row.companyCity].filter(Boolean).join(' · ')}</span>
        <span className="text-[12px] text-accent-500">{t('fields.profile')}: {row.profileName}</span>
      </div>

      {/* Status direkt umschalten */}
      <Dropdown label={<span className="flex items-center gap-2"><StatusBadge status={row.status} /> ▾</span>} width={200}>
        {applicationStatuses.map((s) => (
          <DropdownItem key={s} close checked={s === row.status} onClick={() => run(() => mutate(() => db.applications.update(row.id, { status: s })))}>
            {t(`status.${s}`)}
          </DropdownItem>
        ))}
      </Dropdown>

      <div className="grid grid-cols-2 border border-line">
        <div className="flex flex-col gap-1 p-3">
          <span className="text-[12px] text-accent-400">{t('status.sent')}</span>
          <span className="text-[13px] text-accent-100">{formatDate(row.sentAt, lang)}</span>
        </div>
        <div className="flex flex-col gap-1 border-l border-line p-3">
          <span className="text-[12px] text-accent-400">{t('status.interview')}</span>
          <span className="text-[13px] text-accent-100">{formatDateTime(interview?.startsAt, lang)}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <SectionLabel>{t('archive.attached')}</SectionLabel>
        {row.documents.map((d) => (
          <button key={d.id} type="button" onClick={() => void openInEditor(d.id)} className="text-left text-[13px] text-accent-200 underline-offset-2 hover:text-accent-100 hover:underline">
            {d.title} <span className="text-accent-500">(v{d.version})</span>
          </button>
        ))}
        <div className="flex gap-1.5">
          <MiniButton onClick={() => void requestCreate('cv', row.id)}>+ {t('docShort.cv')}</MiniButton>
          <MiniButton onClick={() => void requestCreate('cover_letter', row.id)}>+ {t('docType.cover_letter')}</MiniButton>
          <MiniButton onClick={() => void requestCreate('cover_page', row.id)}>+ {t('docType.cover_page')}</MiniButton>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center">
          <SectionLabel>{t('archive.events')}</SectionLabel>
          <button type="button" className="ml-auto text-[12px] text-accent-400 hover:text-accent-200" onClick={() => setEventForm('new')}>
            + {t('archive.newEvent')}
          </button>
        </div>
        {events.length === 0 && <span className="text-[12px] text-accent-500">—</span>}
        {events.map((e) => (
          <div key={e.id} className="group flex items-center gap-2 border-l border-accent-400 pl-3 text-[13px]">
            <button type="button" className="flex-1 text-left" onClick={() => setEventForm(e)}>
              <span className="text-accent-100">{t(`eventKind.${e.kind}`)}</span>
              <span className="text-accent-300"> · {formatDateTime(e.startsAt, lang)}</span>
              {e.title && <span className="block text-[12px] text-accent-400">{e.title}</span>}
            </button>
            <button type="button" aria-label={t('common.delete')} className="text-accent-500 opacity-0 hover:text-danger group-hover:opacity-100" onClick={() => run(() => mutate(() => db.events.remove(e.id)))}>
              ×
            </button>
          </div>
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
              const ok = await run(() => mutate(() => db.notes.create({ applicationId: row.id, body: noteDraft })))
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
        <TagEditor tags={row.tags} onChange={(next) => run(() => mutate(() => db.tags.set('application', row.id, next)))} />
      </div>

      {editing && <ApplicationForm initial={row} onClose={() => setEditing(false)} />}
      {eventForm && <EventForm applicationId={row.id} initial={eventForm === 'new' ? undefined : eventForm} onClose={() => setEventForm(null)} />}
      {confirmDelete && (
        <ConfirmDialog
          title={t('archive.deleteApplication')}
          text={t('archive.deleteApplicationText', { name: `${row.companyName} – ${row.role}` })}
          confirmLabel={t('common.delete')}
          danger
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            setConfirmDelete(false)
            const ok = await run(async () => (await mutate(() => db.applications.remove(row.id)), true), t('archive.deleted'))
            if (ok) onDeleted()
          }}
        />
      )}
    </RecordPanel>
  )
}
