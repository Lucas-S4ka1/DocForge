/**
 * [ STATUS ] Statistik: Kennzahlen, Wochenverlauf, Wochenziel und Erfolge.
 */
import { useTranslation } from 'react-i18next'
import type { HubData } from '@shared/models'
import { Panel } from '@/components/ui/Panel'
import { ProgressBar } from '@/components/ui/Controls'
import { useApp } from '@/store/app'
import { WeeklyChart } from './WeeklyChart'

const achievementIcon: Record<string, string> = {
  firstSent: '✉',
  fiveSent: '✦',
  firstInterview: '☏',
  firstOffer: '★',
  firstPhoto: '◉',
  firstBackup: '⛁',
  weeklyGoal: '◎'
}

/** [ STATUS ] Kennzahlen (rechte Spalte, wie im Design). */
export function StatsPanel({ data }: { data: HubData }) {
  const { t } = useTranslation()
  const st = data.stats
  // "Gesendet" = alles, was kein Entwurf mehr ist; "Gespräche" = Gespräch + Zusage
  const tiles = [
    { label: t('hub.statApplications'), value: st.applications, glow: true },
    { label: t('hub.statDrafts'), value: st.byStatus.draft },
    { label: t('hub.statSent'), value: st.applications - st.byStatus.draft },
    { label: t('hub.statInterviews'), value: st.byStatus.interview + st.byStatus.accepted }
  ]
  return (
    <Panel tag="STATUS" title={t('hub.stats')} className="gap-3">
      <div className="grid grid-cols-2 border-l border-t border-line">
        {tiles.map((s) => (
          <div key={s.label} className="flex flex-col gap-1 border-b border-r border-line px-3 py-2.5">
            <span className={`font-heading text-[30px] font-semibold leading-none text-accent-200 ${s.glow ? 'text-glow' : ''}`}>{s.value}</span>
            <span className="text-[10.5px] uppercase tracking-[0.1em] text-accent-400">{s.label}</span>
          </div>
        ))}
      </div>
    </Panel>
  )
}

/** [ STATUS ] Fortschritt: Wochenverlauf, Wochenziel, Erfolge (linke Spalte). */
export function ProgressPanel({ data }: { data: HubData }) {
  const { t } = useTranslation()
  const lang = useApp((s) => s.settings.language)
  const goal = useApp((s) => s.settings.weeklyGoal)
  const update = useApp((s) => s.updateSettings)
  const unlocked = data.achievements.filter((a) => a.done).length

  return (
    <Panel tag="STATUS" title={t('hub.progress')} className="flex-none gap-3">
      <div className="grid grid-cols-[minmax(0,1fr)_250px] gap-6">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-[0.1em] text-accent-400">{t('hub.weeklyTitle')}</span>
          <WeeklyChart data={data.weekly} goal={goal} lang={lang} />
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-[12px] text-accent-300">
              <span>{goal > 0 ? t('hub.goalProgress', { done: data.thisWeekSent, goal }) : t('hub.goalOff')}</span>
              <span className="ml-auto flex items-center border border-line">
                <button type="button" aria-label="−" className="px-2 py-0.5 hover:bg-accent-100/5" onClick={() => update({ weeklyGoal: Math.max(0, goal - 1) })}>
                  −
                </button>
                <span className="border-x border-line px-2 py-0.5 font-mono text-[11px]">{goal}</span>
                <button type="button" aria-label="+" className="px-2 py-0.5 hover:bg-accent-100/5" onClick={() => update({ weeklyGoal: Math.min(50, goal + 1) })}>
                  +
                </button>
              </span>
            </div>
            {goal > 0 && <ProgressBar value={(data.thisWeekSent / goal) * 100} />}
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] uppercase tracking-[0.1em] text-accent-400">
              {t('hub.achievements')} · {unlocked}/{data.achievements.length}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {data.achievements.map((a) => (
                <span
                  key={a.key}
                  title={t(`achievement.${a.key}`)}
                  className={`grid h-7 w-7 place-items-center border text-[13px] ${a.done ? 'border-accent-300 bg-accent-500/20 text-accent-100 shadow-glow-sm' : 'border-line text-accent-700'}`}
                >
                  <span aria-hidden="true">{achievementIcon[a.key]}</span>
                  <span className="sr-only">
                    {t(`achievement.${a.key}`)} – {a.done ? t('hub.unlocked') : t('hub.locked')}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Panel>
  )
}
