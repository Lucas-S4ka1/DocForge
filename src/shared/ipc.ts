/**
 * IPC-Vertrag zwischen Renderer und Main-Process.
 *
 * Der Renderer hat keinen Node-Zugriff (contextIsolation an, nodeIntegration aus).
 * Er spricht ausschließlich über die hier definierten Kanäle mit dem Main-Process;
 * das Preload-Skript stellt sie als `window.docforge` bereit.
 */
import type { AppSettings } from './settings'

/** Alle erlaubten Kanalnamen an einer Stelle – nichts anderes wird durchgereicht. */
export const IpcChannels = {
  appInfo: 'app:info',
  openExternalDataFolder: 'app:open-data-folder',
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  /** Main → Renderer: Menüaktionen (z. B. "Über DocForge"). */
  menuAction: 'menu:action'
} as const

export interface AppInfo {
  name: string
  /** Aus package.json (app.getVersion()). */
  version: string
  /** Nutzerdatenordner (app.getPath('userData')). */
  dataPath: string
  platform: string
  isDev: boolean
}

export type MenuAction = 'about' | 'navigate:hub' | 'navigate:editor' | 'navigate:studio' | 'navigate:archive' | 'navigate:settings'

/** Die API, die der Renderer unter `window.docforge` sieht. */
export interface DocForgeApi {
  app: {
    getInfo(): Promise<AppInfo>
    openDataFolder(): Promise<void>
  }
  settings: {
    get(): Promise<AppSettings>
    set(patch: Partial<AppSettings>): Promise<AppSettings>
  }
  /** Abonniert Menüaktionen; gibt eine Abmelde-Funktion zurück. */
  onMenuAction(cb: (action: MenuAction) => void): () => void
}
