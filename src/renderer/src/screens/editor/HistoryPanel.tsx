/**
 * Versionsverlauf des geöffneten Dokuments – jede Version wiederherstellbar.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { db, useQuery } from '@/store/db'
import { useEditor } from '@/store/editor'
import { useApp } from '@/store/app'
import { toast } from '@/store/toast'
import { formatDateTime } from '@/lib/format'
import { ConfirmDialog } from '@/components/ui/Modal'
import type { Proposal } from '@/store/ai'

export function versionNote(note: string | null, t: (k: string, o?: Record<string, unknown>) => string): string {
  if (!note || note === 'autosave') return t('versionNote.manual')
  if (note === 'created') return t('versionNote.created')
  const m = /^restored v(\d+)$/.exec(note)
  if (m) return t('versionNote.restored', { version: m[1] })
  if (note.startsWith('KI: ')) return `„${note.slice(4)}“`
  return note
}

export function HistoryList({ pending }: { pending?: Proposal }) {
  const { t } = useTranslation()
  const lang = useApp((s) => s.settings.language)
  const doc = useEditor((s) => s.doc)!
  const { flush, reload } = useEditor()
  const versions = useQuery(() => db.documents.versions(doc.id), [doc.id, doc.currentVersion]).data ?? []
  const [restore, setRestore] = useState<number | null>(null)

  return (
    <div className="flex flex-col gap-3">
      {pending && (
        <div className="flex gap-3">
          <span className="mt-1 h-2.5 w-2.5 flex-none border border-accent-300 bg-accent-400 shadow-glow-dot" />
          <div className="flex flex-col">
            <span className="text-[13.5px] font-semibold text-accent-100">v{doc.currentVersion + 1} · {t('ai.proposedShort')}</span>
            <span className="text-[12px] text-accent-300">„{pending.command}“</span>
          </div>
        </div>
      )}
      {versions.slice(0, 30).map((v) => (
        <div key={v.id} className="group flex gap-3">
          <span className={`mt-1 h-2.5 w-2.5 flex-none border ${!pending && v.version === doc.currentVersion ? 'border-accent-300 bg-accent-400 shadow-glow-dot' : 'border-accent-500'}`} />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-[13.5px] font-semibold text-accent-100">v{v.version}</span>
            <span className="truncate text-[12px] text-accent-400" title={v.note ?? ''}>
              {formatDateTime(v.createdAt, lang)} · {versionNote(v.note, t)}
            </span>
          </div>
          {v.version !== doc.currentVersion && !pending && (
            <button type="button" className="self-start text-[12px] text-accent-400 opacity-0 hover:text-accent-200 group-hover:opacity-100" onClick={() => setRestore(v.version)}>
              {t('archive.restoreVersion')}
            </button>
          )}
        </div>
      ))}
      {restore !== null && (
        <ConfirmDialog
          title={t('archive.restoreVersion')}
          text={t('archive.restoreVersionText', { version: restore })}
          confirmLabel={t('archive.restoreVersion')}
          onCancel={() => setRestore(null)}
          onConfirm={async () => {
            const v = restore
            setRestore(null)
            await flush()
            await db.documents.restoreVersion(doc.id, v)
            await reload()
            toast.success(t('archive.versionRestored', { version: v }))
          }}
        />
      )}
    </div>
  )
}
