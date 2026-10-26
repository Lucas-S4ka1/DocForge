/**
 * Registriert alle IPC-Handler. Jeder Kanal ist explizit in @shared/ipc definiert.
 */
import { app, ipcMain, shell } from 'electron'
import { IpcChannels, type AppInfo } from '@shared/ipc'
import type { AppSettings } from '@shared/settings'
import { loadSettings, saveSettings } from './settings-store'
import { buildMenu } from './menu'

export function registerIpc(): void {
  ipcMain.handle(IpcChannels.appInfo, (): AppInfo => ({
    name: app.getName(),
    version: app.getVersion(),
    dataPath: app.getPath('userData'),
    platform: process.platform,
    isDev: !app.isPackaged
  }))

  ipcMain.handle(IpcChannels.openExternalDataFolder, async () => {
    await shell.openPath(app.getPath('userData'))
  })

  ipcMain.handle(IpcChannels.settingsGet, () => loadSettings())

  ipcMain.handle(IpcChannels.settingsSet, (_e, patch: Partial<AppSettings>) => {
    const before = loadSettings().language
    const next = saveSettings(patch ?? {})
    // Menü bei Sprachwechsel neu aufbauen
    if (next.language !== before) buildMenu(next.language)
    return next
  })
}
