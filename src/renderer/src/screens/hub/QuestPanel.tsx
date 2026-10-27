/**
 * [ QUEST ] Aktive Bewerbungen: Fortschritt in %, nächster offener Schritt mit Direktaktion.
 */
import { useTranslation } from 'react-i18next'
import type { Quest, QuestStep } from '@shared/models'
import { Panel, EmptyState } from '@/components/ui/Panel'
import { ProgressBar } from '@/components/ui/Controls'
import { useApp } from '@/store/app'
import { useArchive } from '@/store/archive'
import { openInEditor } from '@/lib/newDocument'
import { requestCreate } from '@/lib/requestCreate'

export function QuestPanel({ quests }: { quests: Quest[] }) {
  const { t } = useTranslation()
  const navigate = useApp((s) => s.navigate)
  const archive = useArchive()

  const openApplication = (id: number) => {
    archive.setTab('applications')
    archive.select('applications', id)
    navigate('archive')
  }

  /** Direktaktion für den nächsten offenen Schritt */
  const act = (q: Quest, step: QuestStep) => {
    switch (step) {
      case 'cv':
      case 'export':
        if (q.cvId) void openInEditor(q.cvId)
        else void requestCreate('cv', q.applicationId)
        break
      case 'photo':
        navigate('studio')
        break
      case 'letter':
        if (q.letterId) void openInEditor(q.letterId)
        else void requestCreate('cover_letter', q.applicationId)
        break
      default:
        openApplication(q.applicationId)
    }
  }

  return (
    <Panel tag="QUEST" title={t('hub.quests')} className="min-h-0 flex-1">
      {quests.length === 0 ? (
        <EmptyState hint={t('hub.questsEmpty')} />
      ) : (
        <div className="-mr-2 flex min-h-0 flex-col overflow-y-auto pr-2">
          {quests.map((q) => (
            <div key={q.applicationId} className="flex flex-col gap-1.5 border-t border-line py-2.5">
              <button type="button" onClick={() => openApplication(q.applicationId)} className="flex items-baseline gap-2 text-left">
                <span className="truncate font-heading text-[16px] font-semibold leading-[1.1] text-accent-100">{q.company}</span>
                <span className="truncate text-[12px] text-accent-400">{q.role}</span>
                <span className="ml-auto font-heading text-[15px] font-semibold leading-none text-accent-300">{q.pct}%</span>
              </button>
              <ProgressBar value={q.pct} />
              <div className="flex items-center gap-2">
                <span className="truncate text-[12px] text-accent-300">
                  {q.next ? t(`quest.next.${q.next}`) : t('quest.done')} · {q.steps.filter((s) => s.done).length}/{q.steps.length}
                </span>
                {q.next && (
                  <button type="button" onClick={() => act(q, q.next!)} className="ml-auto flex-none text-[11.5px] text-accent-400 hover:text-accent-100">
                    {t(`quest.action.${q.next}`)} →
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}
