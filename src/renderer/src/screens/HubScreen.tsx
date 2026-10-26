/**
 * Hub (Dashboard): Schnellaktionen, zuletzt bearbeitete Dokumente, Quests, Statistik.
 * Phase 1: Layout nach Design mit leeren Zuständen. Daten folgen in Phase 2/6.
 */
import { useTranslation } from 'react-i18next'
import { useApp } from '@/store/app'
import { formatSessionDate } from '@/i18n'
import { Panel, Corners, EmptyState } from '@/components/ui/Panel'
import { Icon, type IconName } from '@/components/ui/Icon'
import { ScreenHeader, LocalStorageBadge } from '@/components/layout/ScreenHeader'

interface QuickAction {
  key: 'newCv' | 'newLetter' | 'newDoc' | 'camera'
  icon: IconName
  onClick(): void
}

export function HubScreen() {
  const { t } = useTranslation()
  const navigate = useApp((s) => s.navigate)
  const lang = useApp((s) => s.settings.language)

  const actions: QuickAction[] = [
    { key: 'newCv', icon: 'user', onClick: () => navigate('editor') },
    { key: 'newLetter', icon: 'mail', onClick: () => navigate('editor') },
    { key: 'newDoc', icon: 'fileplus', onClick: () => navigate('editor') },
    { key: 'camera', icon: 'camera', onClick: () => navigate('studio') }
  ]

  const stats = [
    { label: t('hub.statApplications'), value: 0 },
    { label: t('hub.statDrafts'), value: 0 },
    { label: t('hub.statSent'), value: 0 },
    { label: t('hub.statInterviews'), value: 0 }
  ]

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-5 px-[30px] py-[26px]">
      <ScreenHeader
        system={t('hub.system', { date: formatSessionDate(new Date(), lang) })}
        title={t('hub.welcome')}
        aside={
          <>
            <LocalStorageBadge label={t('common.localStorage')} />
            <span className="border border-line px-3 py-[7px] text-[13px] text-accent-200">{t('common.noProfile')} ▾</span>
          </>
        }
      />

      {/* Schnellaktionen */}
      <div className="grid grid-cols-4 gap-4">
        {actions.map((a, i) => (
          <button
            key={a.key}
            type="button"
            onClick={a.onClick}
            className={`blueprint group flex items-center gap-3.5 px-[18px] py-4 text-left transition-[border-color,box-shadow] hover:border-accent-500 hover:shadow-glow ${
              i === 0 ? 'border-accent-500 shadow-glow' : ''
            }`}
          >
            <Corners />
            <Icon name={a.icon} size={26} className="text-accent-300" />
            <span className="flex flex-col gap-0.5">
              <span className="font-heading text-[19px] font-semibold uppercase leading-[1.1] tracking-[0.04em]">
                {t(`hub.actions.${a.key}`)}
              </span>
              <span className="text-[12px] text-accent-400">{t(`hub.actions.${a.key}Hint`)}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_400px] gap-5">
        <Panel
          tag="LOG"
          title={t('hub.recent')}
          aside={
            <button type="button" onClick={() => navigate('archive')} className="uppercase hover:text-accent-200">
              {t('hub.viewArchive')}
            </button>
          }
        >
          <EmptyState hint={t('hub.recentEmpty')} />
        </Panel>

        <div className="flex min-h-0 flex-col gap-5">
          <Panel tag="QUEST" title={t('hub.quests')} className="flex-1">
            <EmptyState hint={t('hub.questsEmpty')} />
          </Panel>
          <Panel tag="STATUS" title={t('hub.stats')}>
            <div className="grid grid-cols-2 border-l border-t border-line">
              {stats.map((s, i) => (
                <div key={s.label} className="flex flex-col gap-1 border-b border-r border-line p-3">
                  <span className={`font-heading text-[34px] font-semibold leading-none text-accent-200 ${i === 0 ? 'text-glow' : ''}`}>
                    {s.value}
                  </span>
                  <span className="text-[11px] uppercase tracking-[0.1em] text-accent-400">{s.label}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </main>
  )
}
