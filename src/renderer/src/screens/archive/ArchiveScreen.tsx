/**
 * Archiv (lokale Datenbank): Tabs für Bewerbungen, Dokumente, Fotos, Firmen, Profile.
 * Suche, Filter (Status, Typ, Profil, Tags), Export als .dfdb und Backup.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { applicationStatuses, type DocumentType, type TagEntity } from '@shared/models'
import { useApp } from '@/store/app'
import { db, mutate, useQuery } from '@/store/db'
import { archiveTabs, useArchive, type ArchiveTab } from '@/store/archive'
import { toast } from '@/store/toast'
import { formatBytes, formatDateTime } from '@/lib/format'
import { Corners } from '@/components/ui/Panel'
import { Icon } from '@/components/ui/Icon'
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown'
import { TagChip } from '@/components/ui/TagEditor'
import { ScreenHeader } from '@/components/layout/ScreenHeader'
import { useAction } from './common'
import { ApplicationsTab } from './ApplicationsTab'
import { DocumentsTab, DocumentTypeFilter } from './DocumentsTab'
import { PhotosTab } from './PhotosTab'
import { CompaniesTab } from './CompaniesTab'
import { ProfilesTab } from './ProfilesTab'

const tagEntityFor: Record<ArchiveTab, TagEntity> = {
  applications: 'application',
  documents: 'document',
  photos: 'photo',
  companies: 'company',
  profiles: 'profile'
}
/** Tabs, in denen man direkt einen neuen Datensatz anlegen kann. */
const creatable: ArchiveTab[] = ['applications', 'companies', 'profiles']

export function ArchiveScreen() {
  const { t } = useTranslation()
  const lang = useApp((s) => s.settings.language)
  const archive = useArchive()
  const { tab, setTab, search, setSearch, statuses, toggleStatus, clearStatuses, profileId, setProfileId, tags, toggleTag } = archive
  const run = useAction()
  const [docType, setDocType] = useState<DocumentType | null>(null)

  const stats = useQuery(() => db.stats.get(), []).data
  const info = useQuery(() => window.docforge.archive.info(), []).data
  const profiles = useQuery(() => db.profiles.list(), []).data ?? []
  const tagList = useQuery(() => db.tags.list(tagEntityFor[tab]), [tab]).data ?? []
  const topTags = tagList.slice(0, 3).map((x) => x.name)
  const isEmpty = stats && stats.profiles + stats.companies === 0

  const backupNow = () =>
    run(async () => {
      const r = await mutate(() => window.docforge.archive.backupNow())
      toast.success(t('archive.backupCreated', { size: formatBytes(r.sizeBytes) }))
    })
  const exportFile = () =>
    run(async () => {
      const r = await mutate(() => window.docforge.archive.exportBackup())
      if (r) toast.success(t('archive.exported', { size: formatBytes(r.sizeBytes) }))
    })

  const profileName = profiles.find((p) => p.id === profileId)?.name

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-[18px] px-[30px] py-[26px]">
      <ScreenHeader
        system={t('archive.system', { apps: stats?.applications ?? 0, docs: stats?.documents ?? 0, photos: stats?.photos ?? 0 })}
        title={t('archive.title')}
        aside={
          <div className="blueprint flex items-center gap-3 border-accent-400 px-4 py-2.5 shadow-glow-sm">
            <Corners />
            <Icon name="lock" size={18} className="text-accent-300" />
            <span className="font-heading text-[12px] font-semibold uppercase tracking-label text-accent-200">{t('common.localStorageLong')}</span>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-line">
        {archiveTabs.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`-mb-px border-b-2 px-4 pb-2.5 pt-1 font-heading text-[13px] font-semibold uppercase tracking-label ${
              tab === id ? 'border-accent-400 text-accent-100' : 'border-transparent text-accent-400 hover:text-accent-200'
            }`}
          >
            {t(`archive.tabs.${id}`)}
            {id === 'profiles' && stats ? ` · ${stats.profiles}` : ''}
          </button>
        ))}
      </div>

      {/* Suche, Filter, Aktionen */}
      <div className="flex flex-wrap items-center gap-2.5">
        <label className="flex w-[340px] items-center gap-2 border border-line px-3 py-2 text-accent-400 focus-within:border-accent-400">
          <Icon name="search" size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-[14px] text-accent-100 placeholder:text-accent-500"
            placeholder={t('archive.search')}
          />
          {search && (
            <button type="button" aria-label={t('common.clear')} onClick={() => setSearch('')} className="text-accent-500 hover:text-accent-200">
              ×
            </button>
          )}
        </label>

        {tab === 'applications' && (
          <Dropdown label={`${statuses.length ? statuses.map((s) => t(`status.${s}`)).join(', ') : t('archive.allStatuses')} ▾`} active={statuses.length > 0}>
            <DropdownItem checked={statuses.length === 0} onClick={clearStatuses}>
              {t('archive.allStatuses')}
            </DropdownItem>
            {applicationStatuses.map((s) => (
              <DropdownItem key={s} checked={statuses.includes(s)} onClick={() => toggleStatus(s)}>
                {t(`status.${s}`)}
              </DropdownItem>
            ))}
          </Dropdown>
        )}
        {tab === 'documents' && <DocumentTypeFilter value={docType} onChange={setDocType} />}

        {(tab === 'applications' || tab === 'documents' || tab === 'photos') && profiles.length > 1 && (
          <Dropdown label={`${t('common.profile', { name: profileName ?? t('archive.allProfiles') })} ▾`} active={!!profileId}>
            <DropdownItem close checked={!profileId} onClick={() => setProfileId(null)}>
              {t('archive.allProfiles')}
            </DropdownItem>
            {profiles.map((p) => (
              <DropdownItem key={p.id} close checked={profileId === p.id} onClick={() => setProfileId(p.id)}>
                {p.name}
              </DropdownItem>
            ))}
          </Dropdown>
        )}

        {/* Häufigste Tags als Schnellfilter, weitere über "+ Filter" */}
        {[...new Set([...topTags, ...tags])].map((name) => (
          <TagChip key={name} name={name} active={tags.includes(name)} onClick={() => toggleTag(name)} />
        ))}
        {tagList.length > topTags.length && (
          <Dropdown label={t('archive.addFilter')}>
            {tagList.map((x) => (
              <DropdownItem key={x.name} checked={tags.includes(x.name)} onClick={() => toggleTag(x.name)}>
                #{x.name} <span className="ml-auto text-[11px] text-accent-500">{x.count}</span>
              </DropdownItem>
            ))}
          </Dropdown>
        )}

        <div className="ml-auto flex gap-2">
          {creatable.includes(tab) && (
            <button type="button" className="btn" onClick={() => archive.setCreating(tab)}>
              + {t(`archive.create.${tab}`)}
            </button>
          )}
          <button type="button" className="btn" onClick={exportFile}>
            {t('archive.export')}
          </button>
          <button type="button" className="btn btn-primary" onClick={backupNow}>
            {t('archive.backupNow')}
          </button>
        </div>
      </div>

      {isEmpty && (
        <div className="flex items-center gap-4 border border-dashed border-accent-500 px-4 py-3 text-[13px] text-accent-200">
          <span className="sys-label text-accent-400">[ SYSTEM ]</span>
          <span>{t('archive.emptyBanner')}</span>
          <button
            type="button"
            className="btn ml-auto"
            onClick={() => run(() => mutate(() => window.docforge.archive.seedDemo()), t('archive.demoCreated'))}
          >
            {t('archive.loadDemo')}
          </button>
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_340px] gap-5">
        {tab === 'applications' && <ApplicationsTab />}
        {tab === 'documents' && <DocumentsTab type={docType} />}
        {tab === 'photos' && <PhotosTab />}
        {tab === 'companies' && <CompaniesTab />}
        {tab === 'profiles' && <ProfilesTab />}
      </div>

      <footer className="flex gap-6 font-mono text-[12px] text-accent-400">
        <span className="truncate">{info?.path}</span>
        <span>{info ? formatBytes(info.sizeBytes) : ''}</span>
        <span className="ml-auto flex-none">
          {t('archive.lastBackup')} {info?.lastBackupAt ? formatDateTime(info.lastBackupAt, lang) : t('archive.never')}
        </span>
      </footer>
    </main>
  )
}
