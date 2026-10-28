/**
 * Hub (Dashboard): Schnellaktionen, zuletzt bearbeitete Dokumente, Quests, Statistik.
 * Hinweise (Termine, Nachfassen, Backup) und Quests pro Bewerbung werden lokal berechnet.
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
import { requestCreate } from '@/lib/requestCreate'
import { openInEditor } from '@/lib/newDocument'
import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { documentTypes } from '@shared/models'
import { QuestPanel } from './hub/QuestPanel'
import { ProgressPanel, StatsPanel } from './hub/StatsPanel'
import { Notices } from './hub/Notices'
import { useImport } from '@/store/importer'

interface QuickAction {
  key: 'newCv' | 'newLetter' | 'newDoc' | 'import' | 'camera'
  icon: IconName
  onClick(): void
}

export function HubScreen() {
  const { t } = useTranslation()
  const navigate = useApp((s) => s.navigate)
  const [chooseType, setChooseType] = useState(false)
  const lang = useApp((s) => s.settings.language)
  const activeProfileId = useApp((s) => s.settings.activeProfileId)
  const profile = useQuery(() => (activeProfileId ? db.profiles.get(activeProfileId).catch(() => null) : Promise.resolve(null)), [activeProfileId]).data
  const weeklyGoal = useApp((s) => s.settings.weeklyGoal)
  const hub = useQuery(() => db.dashboard.get(activeProfileId, weeklyGoal), [activeProfileId, weeklyGoal]).data
  const recent = useQuery(() => db.documents.list({ profileId: activeProfileId, limit: 6 }), [activeProfileId]).data ?? []

  const actions: QuickAction[] = [
    { key: 'newCv', icon: 'user', onClick: () => void requestCreate('cv') },
    { key: 'newLetter', icon: 'mail', onClick: () => void requestCreate('cover_letter') },
    { key: 'newDoc', icon: 'fileplus', onClick: () => setChooseType(true) },
    { key: 'import', icon: 'fileimport', onClick: () => void useImport.getState().begin() },
    { key: 'camera', icon: 'camera', onClick: () => navigate('studio') }
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
      <div className="grid grid-cols-5 gap-4">
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
        <div className="flex min-h-0 flex-col gap-4">
          {hub && <Notices notices={hub.notices} />}
          <Panel
            className="min-h-0 flex-1"
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
              <div className="grid min-h-0 flex-1 auto-rows-[minmax(0,1fr)] grid-cols-3 gap-4 overflow-hidden">
                {recent.map((d) => (
                  <RecentCard key={d.id} doc={d} edited={formatDateTime(d.updatedAt, lang)} />
                ))}
              </div>
            )}
          </Panel>
          {hub && <ProgressPanel data={hub} />}
        </div>

        <div className="flex min-h-0 flex-col gap-5">
          {hub ? <QuestPanel quests={hub.quests} /> : <div className="flex-1" />}
          {hub && <StatsPanel data={hub} />}
        </div>
      </div>
      {chooseType && (
        <Modal tag="NEU" title={t('hub.actions.newDoc')} onClose={() => setChooseType(false)} width={420}>
          <div className="flex flex-col gap-2">
            {documentTypes.map((type) => (
              <button
                key={type}
                type="button"
                className="btn justify-start py-3 text-[15px]"
                onClick={() => {
                  setChooseType(false)
                  void requestCreate(type)
                }}
              >
                + {t(`docType.${type}`)}
              </button>
            ))}
            <div className="my-1 border-t border-line" />
            <button
              type="button"
              className="btn justify-start py-3 text-[15px]"
              onClick={() => {
                setChooseType(false)
                void useImport.getState().begin()
              }}
            >
              ↥ {t('import.fromFile')}
            </button>
          </div>
        </Modal>
      )}
    </main>
  )
}

/** Dokumentkarte mit Mini-A4-Vorschau wie im Design. */
function RecentCard({ doc, edited }: { doc: DocumentRow; edited: string }) {
  const { t } = useTranslation()
  return (
    <button type="button" onClick={() => void openInEditor(doc.id)} className="flex min-h-0 gap-3.5 overflow-hidden border border-line bg-accent-900/35 p-3 text-left transition-colors hover:border-accent-500">
      <div className="flex aspect-[1/1.414] h-full max-h-[136px] flex-none flex-col gap-1 self-start overflow-hidden bg-[#f5f5f8] px-2 py-2.5 shadow-[0_0_0_1px_rgb(var(--accent-400)/0.3)]">
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
    </button>
  )
}
