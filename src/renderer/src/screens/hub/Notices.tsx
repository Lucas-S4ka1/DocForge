/**
 * Systemmeldungen im Hub: Termine, Nachfassen, Backup-Erinnerung.
 */
import { useTranslation } from 'react-i18next'
import type { Notice } from '@shared/models'
import { useApp } from '@/store/app'
import { useArchive } from '@/store/archive'
import { mutate } from '@/store/db'
import { toast } from '@/store/toast'
import { formatDateTime, formatBytes } from '@/lib/format'

export function Notices({ notices }: { notices: Notice[] }) {
  const { t } = useTranslation()
  const lang = useApp((s) => s.settings.language)
  const navigate = useApp((s) => s.navigate)
  const archive = useArchive()
  if (!notices.length) return null

  const open = (id: number) => {
    archive.setTab('applications')
    archive.select('applications', id)
    navigate('archive')
  }

  return (
    <div className="flex flex-col gap-1 border border-line bg-accent-900/30 px-4 py-2.5 font-mono text-[12.5px]">
      {notices.slice(0, 4).map((n, i) => {
        if (n.kind === 'event')
          return (
            <button key={i} type="button" onClick={() => open(n.applicationId)} className="flex gap-2 text-left text-accent-100 hover:text-white">
              <span className="text-accent-400">[ TERMIN ]</span>
              {t('hub.notice.event', { kind: t(`eventKind.${n.eventKind}`), company: n.company, when: formatDateTime(n.startsAt, lang) })}
            </button>
          )
        if (n.kind === 'followup')
          return (
            <button key={i} type="button" onClick={() => open(n.applicationId)} className="flex gap-2 text-left text-accent-100 hover:text-white">
              <span className="text-accent-400">[ QUEST ]</span>
              {t('hub.notice.followup', { company: n.company, days: n.days })}
            </button>
          )
        return (
          <button
            key={i}
            type="button"
            onClick={async () => {
              try {
                const r = await mutate(() => window.docforge.archive.backupNow())
                toast.success(t('archive.backupCreated', { size: formatBytes(r.sizeBytes) }))
              } catch {
                toast.error(t('errors.INTERNAL'))
              }
            }}
            className="flex gap-2 text-left text-accent-100 hover:text-white"
          >
            <span className="text-accent-400">[ SYSTEM ]</span>
            {n.days === null ? t('hub.notice.backupNever') : t('hub.notice.backup', { days: n.days })}
          </button>
        )
      })}
    </div>
  )
}
