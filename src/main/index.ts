/**
 * DocForge – Main-Process.
 * Erstellt das Hauptfenster, härtet die Sicherheit und registriert die IPC-Schicht.
 */
import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { registerIpc } from './ipc'
import { buildMenu } from './menu'
import { loadSettings } from './settings-store'
import { hardenSession, hardenWebContents } from './security'
import { initDatabase, shutdownDatabase, startAutoBackup } from './db/service'
import { registerPhotoProtocol, registerPhotoScheme } from './photo-protocol'
import { initUpdater } from './updater'

const isDev = !app.isPackaged

// Software-WebGL als Fallback, wenn die Grafikkarte blockiert/nicht vorhanden ist
// (z. B. Schulungs-PCs, VMs). Nötig für die lokale Hintergrund-Erkennung im Kamera-Studio.
// Unbedenklich, da der Renderer ausschließlich eigene, lokale Inhalte lädt.
app.commandLine.appendSwitch('enable-unsafe-swiftshader')
const devServerUrl = process.env['ELECTRON_RENDERER_URL']

function isAllowedUrl(url: string): boolean {
  if (devServerUrl && url.startsWith(devServerUrl)) return true
  return url.startsWith('file://')
}

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1180,
    minHeight: 720,
    show: false,
    title: 'DocForge',
    backgroundColor: '#05070D',
    autoHideMenuBar: process.platform !== 'darwin',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false
    }
  })

  hardenWebContents(win.webContents, isAllowedUrl)
  win.once('ready-to-show', () => win.show())

  if (isDev && devServerUrl) {
    void win.loadURL(devServerUrl)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return win
}

// Nur eine Instanz zulassen (verhindert parallele Zugriffe auf die Datenbank)
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  registerPhotoScheme()

  app.whenReady().then(async () => {
    app.setAppUserModelId('works.pj.docforge')
    hardenSession()
    try {
      await initDatabase()
    } catch (e) {
      // Ohne Datenbank kann die App nicht sinnvoll laufen → klare Meldung statt stillem Fehler
      const { dialog } = await import('electron')
      dialog.showErrorBox('DocForge', `Die lokale Datenbank konnte nicht geöffnet werden.\n\n${e instanceof Error ? e.message : ''}`)
      app.quit()
      return
    }
    registerPhotoProtocol()
    registerIpc()
    initUpdater()
    startAutoBackup()
    buildMenu(loadSettings().language)
    createMainWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
    })
  })

  app.on('will-quit', () => shutdownDatabase())

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
