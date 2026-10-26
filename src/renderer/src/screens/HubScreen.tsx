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
import { ProfileSwitcher } from '@/components/layout/ProfileSwitcher'
import { db, useQuery } from '@/store/db'
import { formatDateTime } from '@/lib/format'
import type { DocumentRow } from '@shared/models'

interface QuickAction {
  key: 'newCv' | 'newLetter' | 'newDoc' | 'camera'
  icon: IconName
  onClick(): void
}

export function HubScreen() {
  const { t } = useTranslation()
  const navigate = useApp((s) => s.navigate)
  const lang = useApp((s) => s.settings.language)
  const activeProfileId = useApp((s) => s.settings.activeProfileId)
  const profile = useQuery(() => (activeProfileId ? db.profiles.get(activeProfileId).catch(() => null) : Promise.resolve(null)), [activeProfileId]).data
  const st = useQuery(() => db.stats.get(activeProfileId), [activeProfileId]).data
  const recent = useQuery(() => db.documents.list({ profileId: activeProfileId, limit: 6 }), [activeProfileId]).data ?? []

  const actions: QuickAction[] = [
    { key: 'newCv', icon: 'user', onClick: () => navigate('editor') },
    { key: 'newLetter', icon: 'mail', onClick: () => navigate('editor') },
    { key: 'newDoc', icon: 'fileplus', onClick: () => navigate('editor') },
    { key: 'camera', icon: 'camera', onClick: () => navigate('studio') }
  ]

  // "Gesendet" = alles, was kein Entwurf mehr ist; "Gespräche" = Gespräch + Zusage
  const stats = [
    { label: t('hub.statApplications'), value: st?.applications ?? 0 },
    { label: t('hub.statDrafts'), value: st?.byStatus.draft ?? 0 },
    { label: t('hub.statSent'), value: st ? st.applications - st.byStatus.draft : 0 },
    { label: t('hub.statInterviews'), value: st ? st.byStatus.interview + st.byStatus.accepted : 0 }
  ]

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-5 px-[30px] py-[26px]">
      <ScreenHeader
        system={t('hub.system', { date: formatSessionDate(new Date(), lang) })}
        title={profile ? t('hub.welcomeBack', { name: profile.name.split(' ')[0] }) : t('hub.welcome')}
        aside={
          <>
            <LocalStorageBadge label={t('common.localStorage')} />
            <ProfileSwitcher />
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
          {recent.length === 0 ? (
            <EmptyState hint={t('hub.recentEmpty')} />
          ) : (
            <div className="grid min-h-0 flex-1 grid-cols-3 content-start gap-4">
              {recent.map((d) => (
                <RecentCard key={d.id} doc={d} edited={formatDateTime(d.updatedAt, lang)} />
              ))}
            </div>
          )}
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

/** Dokumentkarte mit Mini-A4-Vorschau wie im Design. */
function RecentCard({ doc, edited }: { doc: DocumentRow; edited: string }) {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-0 gap-3.5 border border-line bg-accent-900/35 p-3">
      <div className="flex aspect-[1/1.414] w-[96px] flex-none flex-col gap-1 self-start bg-[#f5f5f8] px-2 py-2.5 shadow-[0_0_0_1px_rgb(var(--accent-400)/0.3)]">
        <span className="h-[5px] w-3/5 bg-[#424244]" />
        <span className="h-[2px] w-2/5 bg-accent-600" />
        {[100, 90, 95, 70, 100, 85, 60].map((w, i) => (
          <span key={i} className={`h-[2px] bg-[#d4d4d7] ${i === 0 || i === 4 ? 'mt-1.5' : ''}`} style={{ width: `${w}%` }} />
        ))}
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="font-heading text-[10px] font-semibold uppercase leading-none tracking-system text-accent-400">{t(`docType.${doc.type}`)}</span>
        <span className="font-heading text-[17px] font-semibold leading-[1.15] text-accent-100">{doc.title}</span>
        <span className="text-[12px] text-accent-300">{doc.companyName ?? ''}</span>
        <span className="mt-auto text-[11px] text-accent-500">{edited}</span>
      </div>
    </div>
  )
}
