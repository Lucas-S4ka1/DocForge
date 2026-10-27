/**
 * Globaler UI-State (Zustand): aktiver Screen, App-Infos, Einstellungen, Dialoge.
 * Einstellungen werden über IPC im Main-Process persistiert.
 */
import { create } from 'zustand'
import type { AppInfo } from '@shared/ipc'
import { defaultSettings, type AppSettings } from '@shared/settings'
import type { DocumentType } from '@shared/models'

export type ScreenId = 'hub' | 'editor' | 'studio' | 'archive' | 'settings'

interface AppState {
  screen: ScreenId
  info: AppInfo | null
  settings: AppSettings
  ready: boolean
  aboutOpen: boolean
  /** Dokument, das nach dem Anlegen eines Profils erstellt werden soll */
  pendingCreate: { type: DocumentType; applicationId: number | null } | null
  setPendingCreate(p: { type: DocumentType; applicationId: number | null } | null): void
  navigate(screen: ScreenId): void
  setAboutOpen(open: boolean): void
  init(): Promise<void>
  updateSettings(patch: Partial<AppSettings>): Promise<void>
}

export const useApp = create<AppState>((set, get) => ({
  screen: 'hub',
  info: null,
  settings: defaultSettings,
  ready: false,
  aboutOpen: false,
  pendingCreate: null,
  setPendingCreate: (pendingCreate) => set({ pendingCreate }),

  navigate: (screen) => set({ screen }),
  setAboutOpen: (aboutOpen) => set({ aboutOpen }),

  init: async () => {
    const [info, settings] = await Promise.all([window.docforge.app.getInfo(), window.docforge.settings.get()])
    set({ info, settings, ready: true })
  },

  updateSettings: async (patch) => {
    // Optimistisch anwenden, damit Schalter/Slider sofort reagieren
    set({ settings: { ...get().settings, ...patch } })
    const saved = await window.docforge.settings.set(patch)
    set({ settings: saved })
  }
}))
