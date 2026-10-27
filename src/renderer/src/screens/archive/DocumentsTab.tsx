/**
 * Tab "Dokumente": Liste aller Dokumente + Detail mit Versionsverlauf (wiederherstellbar).
 * Neue Dokumente werden im Hub/Editor angelegt.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { documentTypes, type DocumentRow, type DocumentType } from '@shared/models'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/Panel'
import { TagEditor } from '@/components/ui/TagEditor'
import { ConfirmDialog } from '@/components/ui/Modal'
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown'
import { db, mutate, useQuery } from '@/store/db'
import { useApp } from '@/store/app'
import { useArchive } from '@/store/archive'
import { formatDate, formatDateTime } from '@/lib/format'
import { openInEditor } from '@/lib/newDocument'
import { MiniButton, RecordPanel, SectionLabel, useAction, useDebounced } from './common'

export function DocumentTypeFilter({ value, onChange }: { value: DocumentType | null; onChange(v: DocumentType | null): void }) {
  const { t } = useTranslation()
  return (
    <Dropdown label={`${value ? t(`docType.${value}`) : t('archive.allTypes')} ▾`} active={!!value}>
      <DropdownItem close checked={!value} onClick={() => onChange(null)}>
        {t('archive.allTypes')}
      </DropdownItem>
      {documentTypes.map((d) => (
        <DropdownItem key={d} close checked={value === d} onClick={() => onChange(d)}>
          {t(`docType.${d}`)}
        </DropdownItem>
      ))}
    </Dropdown>
  )
}

export function DocumentsTab({ type }: { type: DocumentType | null }) {
  const { t } = useTranslation()
  const lang = useApp((s) => s.settings.language)
  const { search, profileId, tags, selected, select } = useArchive()
  const q = useDebounced(search)
  const { data: rows = [] } = useQuery(
    () => db.documents.list({ search: q, profileId, tags, type: type ?? undefined }),
    [q, profileId, tags.join(), type]
  )

  const columns: Column<DocumentRow>[] = [
    { key: 'title', label: t('archive.columns.title'), width: '1.6fr', render: (r) => <span className="text-accent-100">{r.title}</span> },
    { key: 'type', label: t('archive.columns.type'), width: '0.9fr', render: (r) => <span className="text-[13px] text-accent-300">{t(`docType.${r.type}`)}</span> },
    { key: 'company', label: t('archive.columns.company'), width: '1.1fr', render: (r) => <span className="text-[13px] text-accent-200">{r.companyName ?? '—'}</span> },
    { key: 'version', label: t('archive.columns.version'), width: '0.5fr', render: (r) => <span className="font-mono text-[12px] text-accent-300">v{r.currentVersion}</span> },
    { key: 'updated', label: t('archive.columns.updated'), width: '0.6fr', render: (r) => <span className="text-[13px] text-accent-300">{formatDate(r.updatedAt, lang)}</span> }
  ]

  return (
    <>
      <DataTable
        columns={columns}
        rows={rows}
        selectedId={selected.documents}
        onSelect={(r) => select('documents', r.id)}
        empty={<EmptyState title={t('archive.emptyDocuments')} hint={t('archive.emptyDocumentsHint')} />}
      />
      <DocumentDetail id={selected.documents ?? null} onDeleted={() => select('documents', null)} />
    </>
  )
}

function DocumentDetail({ id, onDeleted }: { id: number | null; onDeleted(): void }) {
  const { t } = useTranslation()
  const lang = useApp((s) => s.settings.language)
  const run = useAction()
  const doc = useQuery(() => (id ? db.documents.list({}).then((l) => l.find((d) => d.id === id) ?? null) : Promise.resolve(null)), [id]).data
  const versions = useQuery(() => (id ? db.documents.versions(id) : Promise.resolve([])), [id]).data ?? []
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmRestore, setConfirmRestore] = useState<number | null>(null)

  if (!id || !doc) return <RecordPanel id={null} />

  return (
    <RecordPanel
      id={doc.id}
      actions={
        <>
          <MiniButton onClick={() => run(() => mutate(() => db.documents.duplicate(doc.id)), t('archive.duplicated'))}>{t('archive.duplicate')}</MiniButton>
          <MiniButton danger onClick={() => setConfirmDelete(true)}>
            {t('common.delete')}
          </MiniButton>
        </>
      }
    >
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-[22px] text-accent-100">{doc.title}</h2>
        <span className="text-[13px] text-accent-300">
          {t(`docType.${doc.type}`)} · {doc.profileName}
          {doc.companyName ? ` · ${doc.companyName}` : ''}
        </span>
      </div>
      <button type="button" className="btn btn-primary self-start" onClick={() => void openInEditor(doc.id)}>
        {t('archive.openInEditor')}
      </button>

      <div className="flex flex-col gap-2">
        <SectionLabel>{t('archive.versions')}</SectionLabel>
        {versions.map((v) => (
          <div key={v.id} className="group flex items-start gap-3 text-[13px]">
            <span className={`mt-1 h-2.5 w-2.5 flex-none border ${v.version === doc.currentVersion ? 'border-accent-300 bg-accent-400 shadow-glow-dot' : 'border-accent-500'}`} />
            <div className="flex flex-1 flex-col">
              <span className="font-semibold text-accent-100">v{v.version}</span>
              <span className="text-[12px] text-accent-400">
                {formatDateTime(v.createdAt, lang)} · {versionNoteText(v.note, t)}
              </span>
            </div>
            {v.version !== doc.currentVersion && (
              <button type="button" className="text-[12px] text-accent-400 opacity-0 hover:text-accent-200 group-hover:opacity-100" onClick={() => setConfirmRestore(v.version)}>
                {t('archive.restoreVersion')}
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-auto flex flex-col gap-2 pt-2">
        <SectionLabel>{t('archive.tags')}</SectionLabel>
        <TagEditor tags={doc.tags} onChange={(next) => run(() => mutate(() => db.tags.set('document', doc.id, next)))} />
      </div>

      {confirmRestore !== null && (
        <ConfirmDialog
          title={t('archive.restoreVersion')}
          text={t('archive.restoreVersionText', { version: confirmRestore })}
          confirmLabel={t('archive.restoreVersion')}
          onCancel={() => setConfirmRestore(null)}
          onConfirm={() => {
            const v = confirmRestore
            setConfirmRestore(null)
            void run(() => mutate(() => db.documents.restoreVersion(doc.id, v)), t('archive.versionRestored', { version: v }))
          }}
        />
      )}
      {confirmDelete && (
        <ConfirmDialog
          title={t('archive.deleteDocument')}
          text={t('archive.deleteDocumentText', { name: doc.title })}
          confirmLabel={t('common.delete')}
          danger
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            setConfirmDelete(false)
            const ok = await run(async () => (await mutate(() => db.documents.remove(doc.id)), true), t('archive.deleted'))
            if (ok) onDeleted()
          }}
        />
      )}
    </RecordPanel>
  )
}

/** Übersetzt gespeicherte Versionsnotizen ("created", "restored v3", freier Text). */
function versionNoteText(note: string | null, t: (k: string, o?: Record<string, unknown>) => string): string {
  if (!note) return t('versionNote.manual')
  const m = /^restored v(\d+)$/.exec(note)
  if (m) return t('versionNote.restored', { version: m[1] })
  return note === 'created' ? t('versionNote.created') : note
}
