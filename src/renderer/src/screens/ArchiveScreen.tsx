/**
 * Archiv (lokale Datenbank). Phase 1: Layout nach Design mit leerer Tabelle.
 * SQLite, Suche, Filter, Tags und Backup folgen in Phase 2.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '@/store/app'
import { Corners, EmptyState } from '@/components/ui/Panel'
import { Icon } from '@/components/ui/Icon'
import { ScreenHeader } from '@/components/layout/ScreenHeader'

const tabs = ['applications', 'documents', 'photos', 'companies', 'profiles'] as const
type Tab = (typeof tabs)[number]

export function ArchiveScreen() {
  const { t } = useTranslation()
  const dataPath = useApp((s) => s.info?.dataPath ?? '')
  const [tab, setTab] = useState<Tab>('applications')
  const later = t('common.comingInPhase', { phase: 2 })

  const cols = ['company', 'role', 'documents', 'status', 'updated'] as const

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-[18px] px-[30px] py-[26px]">
      <ScreenHeader
        system={t('archive.system', { apps: 0, docs: 0, photos: 0 })}
        title={t('archive.title')}
        aside={
          <div className="blueprint flex items-center gap-3 border-accent-400 px-4 py-2.5 shadow-glow-sm">
            <Corners />
            <Icon name="lock" size={18} className="text-accent-300" />
            <span className="font-heading text-[12px] font-semibold uppercase tracking-label text-accent-200">
              {t('common.localStorageLong')}
            </span>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-line">
        {tabs.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`-mb-px border-b-2 px-4 pb-2.5 pt-1 font-heading text-[13px] font-semibold uppercase tracking-label ${
              tab === id ? 'border-accent-400 text-accent-100' : 'border-transparent text-accent-400 hover:text-accent-200'
            }`}
          >
            {t(`archive.tabs.${id}`)}
          </button>
        ))}
      </div>

      {/* Suche & Aktionen */}
      <div className="flex items-center gap-2.5">
        <label className="flex w-[340px] items-center gap-2 border border-line px-3 py-2 text-accent-400">
          <Icon name="search" size={16} />
          <input className="w-full bg-transparent text-[14px] text-accent-100 placeholder:text-accent-500" placeholder={t('archive.search')} disabled />
        </label>
        <span className="border border-accent-400 px-3 py-[7px] text-[12px] text-accent-200">{t('archive.allStatuses')}</span>
        <span className="border border-dashed border-line px-3 py-[7px] text-[12px] text-accent-400">{t('archive.addFilter')}</span>
        <div className="ml-auto flex gap-2">
          <button type="button" className="btn" disabled title={later}>{t('archive.export')}</button>
          <button type="button" className="btn btn-primary" disabled title={later}>{t('archive.backupNow')}</button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_340px] gap-5">
        <div className="flex min-h-0 flex-col border border-line">
          <div className="grid grid-cols-[1.2fr_1.2fr_1.1fr_0.7fr_0.6fr] border-b border-line px-3.5 py-3">
            {cols.map((c) => (
              <span key={c} className="text-[11px] uppercase tracking-[0.08em] text-accent-400">
                {t(`archive.columns.${c}`)}
              </span>
            ))}
          </div>
          <div className="flex flex-1 p-4">
            <EmptyState title={t('archive.empty')} hint={later} />
          </div>
        </div>
        <section className="blueprint flex flex-col gap-3 p-[18px]">
          <Corners />
          <span className="sys-label text-accent-400">{t('archive.record')}</span>
          <EmptyState hint={t('archive.noRecord')} />
        </section>
      </div>

      <footer className="flex font-mono text-[12px] text-accent-400">
        <span>{dataPath}</span>
      </footer>
    </main>
  )
}
