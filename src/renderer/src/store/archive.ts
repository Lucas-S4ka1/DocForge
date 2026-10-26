/**
 * UI-State des Archivs (bleibt beim Tab-/Screenwechsel erhalten):
 * aktiver Tab, Suche, Filter und ausgewählter Datensatz je Tab.
 */
import { create } from 'zustand'
import type { ApplicationStatus } from '@shared/models'

export const archiveTabs = ['applications', 'documents', 'photos', 'companies', 'profiles'] as const
export type ArchiveTab = (typeof archiveTabs)[number]

interface ArchiveState {
  tab: ArchiveTab
  search: string
  statuses: ApplicationStatus[]
  /** null = alle Profile */
  profileId: number | null
  tags: string[]
  selected: Partial<Record<ArchiveTab, number | null>>
  /** Tab, in dem gerade der "Neu anlegen"-Dialog offen ist. */
  creating: ArchiveTab | null
  setCreating(tab: ArchiveTab | null): void
  setTab(tab: ArchiveTab): void
  setSearch(s: string): void
  toggleStatus(s: ApplicationStatus): void
  clearStatuses(): void
  setProfileId(id: number | null): void
  toggleTag(tag: string): void
  select(tab: ArchiveTab, id: number | null): void
}

export const useArchive = create<ArchiveState>((set, get) => ({
  tab: 'applications',
  search: '',
  statuses: [],
  profileId: null,
  tags: [],
  selected: {},
  creating: null,
  setCreating: (creating) => set({ creating }),
  setTab: (tab) => set({ tab, tags: [] }),
  setSearch: (search) => set({ search }),
  toggleStatus: (s) => {
    const cur = get().statuses
    set({ statuses: cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s] })
  },
  clearStatuses: () => set({ statuses: [] }),
  setProfileId: (profileId) => set({ profileId }),
  toggleTag: (tag) => {
    const cur = get().tags
    set({ tags: cur.includes(tag) ? cur.filter((x) => x !== tag) : [...cur, tag] })
  },
  select: (tab, id) => set({ selected: { ...get().selected, [tab]: id } })
}))
