/**
 * Auto-Update über GitHub Releases (electron-updater).
 * - Kein automatischer Download: Nutzer entscheidet ("Herunterladen")
 * - Vor der Installation wird automatisch ein Backup der lokalen Datenbank angelegt
 * - Offline / kein Update → klare Statusmeldung statt Fehlerdialog
 * - Migrationen laufen nach dem Neustart automatisch (siehe db/service.ts)
 */
import { app, BrowserWindow, ipcMain } from 'electron'
import electronUpdater, { type UpdateInfo } from 'electron-updater'
import { IpcChannels, type UpdateStatus } from '@shared/ipc'
import { loadSettings } from './settings-store'
import { backupTo } from './db/service'

const { autoUpdater } = electronUpdater

let status: UpdateStatus = { state: 'idle' }

function send(s: UpdateStatus): void {
  status = s
  BrowserWindow.getAllWindows().forEach((w) => w.webContents.send(IpcChannels.updateStatus, s))
}

/** Release-Notes von GitHub kommen als HTML → einfacher Text für die Anzeige. */
function notesToText(info: UpdateInfo): string {
  const raw = Array.isArray(info.releaseNotes) ? info.releaseNotes.map((n) => n.note ?? '').join('\n\n') : (info.releaseNotes ?? '')
  return raw
    .replace(/<\/(p|li|h\d)>/gi, '\n')
    .replace(/<li>/gi, '• ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const isOfflineError = (e: unknown) =>
  /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|ENETUNREACH|EAI_AGAIN|ERR_INTERNET_DISCONNECTED|ERR_NAME_NOT_RESOLVED|net::ERR/i.test(String(e instanceof Error ? e.message : e))

export function initUpdater(): void {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.logger = null

  autoUpdater.on('checking-for-update', () => send({ state: 'checking' }))
  autoUpdater.on('update-available', (info) =>
    send({ state: 'available', version: info.version, notes: notesToText(info), date: info.releaseDate ?? null })
  )
  autoUpdater.on('update-not-available', () => send({ state: 'none', version: app.getVersion() }))
  autoUpdater.on('download-progress', (p) =>
    send({ state: 'downloading', percent: Math.round(p.percent), version: status.state === 'available' || status.state === 'downloading' ? status.version : '' })
  )
  autoUpdater.on('update-downloaded', (info) => send({ state: 'downloaded', version: info.version }))
  autoUpdater.on('error', (e) => send(isOfflineError(e) ? { state: 'offline' } : { state: 'error', message: 'UPDATE_FAILED' }))

  ipcMain.handle(IpcChannels.updateCheck, () => checkForUpdates())
  ipcMain.handle(IpcChannels.updateDownload, async () => {
    try {
      await autoUpdater.downloadUpdate()
    } catch (e) {
      send(isOfflineError(e) ? { state: 'offline' } : { state: 'error', message: 'DOWNLOAD_FAILED' })
    }
  })
  ipcMain.handle(IpcChannels.updateInstall, async () => {
    // Sicherheits-Backup vor dem Update
    try {
      await backupTo(undefined, 'pre-update')
    } catch {
      console.warn('[update] Backup vor Update fehlgeschlagen')
    }
    setImmediate(() => autoUpdater.quitAndInstall(false, true))
  })

  // Optional automatische Prüfung beim Start
  if (loadSettings().checkUpdatesOnStart && app.isPackaged) setTimeout(() => void checkForUpdates(), 6000)
}

export async function checkForUpdates(): Promise<void> {
  if (!app.isPackaged) {
    send({ state: 'dev' })
    return
  }
  try {
    await autoUpdater.checkForUpdates()
  } catch (e) {
    send(isOfflineError(e) ? { state: 'offline' } : { state: 'error', message: 'CHECK_FAILED' })
  }
}
