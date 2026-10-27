/**
 * Registriert alle IPC-Handler. Jeder Kanal ist explizit in @shared/ipc definiert.
 * Fehler werden als "[CODE] Nachricht" weitergegeben – ohne Nutzerdaten.
 */
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { IpcChannels, dbMethodNames, type AppInfo, type DbContract } from '@shared/ipc'
import type { AppSettings } from '@shared/settings'
import { loadSettings, saveSettings } from './settings-store'
import { buildMenu } from './menu'
import { DbError } from './db/errors'
import { backupDir, backupTo, dbInfo, getRepos, restoreFrom, startAutoBackup } from './db/service'
import { backupFileName } from './db/backup'
import { seedDemo } from './db/seed'
import { AiError, cancelRun, runCommand, testKey } from './ai/claude'
import { KeyStoreError, keyStatus, removeApiKey, saveApiKey } from './ai/keystore'
import { validateChanges } from '@shared/ai'
import { dataPaths } from './db/connection'
import { renderPdf, printJobFor } from './export/pdf'
import { buildDocx } from './export/docx'
import { createContent, contentKindFor, isDocContent } from '@shared/document'
import { nativeImage, systemPreferences } from 'electron'
import { copyFileSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { extname, join } from 'node:path'

/** Dateiname aus Dokumenttitel (ohne problematische Zeichen). */
const safeFileName = (title: string) => title.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '_').slice(0, 80) || 'Dokument'

/** Lädt ein Dokument mit gültigem Inhalt (leere Altdokumente bekommen Standardinhalt). */
function loadDoc(id: number) {
  const doc = getRepos().documents.get(id)
  const content = isDocContent(doc.content) && doc.content.kind === contentKindFor[doc.type] ? doc.content : createContent(doc.type, null, doc.language)
  return { ...doc, content }
}

/** Wandelt beliebige Fehler in eine sichere, codierte Meldung um. */
function toIpcError(e: unknown): Error {
  if (e instanceof DbError) return new Error(`[${e.code}] ${e.message}`)
  if (e instanceof AiError || e instanceof KeyStoreError) return new Error(`[${e.code}]`)
  // Unerwartete Fehler: nur Typ loggen, keine Inhalte (könnten Nutzerdaten enthalten)
  console.error('[ipc] Unerwarteter Fehler:', e instanceof Error ? e.name : typeof e)
  return new Error('[INTERNAL] Unexpected error')
}

function handle<A extends unknown[], R>(channel: string, fn: (...args: A) => R | Promise<R>): void {
  ipcMain.handle(channel, async (_e, ...args) => {
    try {
      return await fn(...(args as A))
    } catch (e) {
      throw toIpcError(e)
    }
  })
}

const notifyDbChanged = () => BrowserWindow.getAllWindows().forEach((w) => w.webContents.send(IpcChannels.dbChanged))

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
    const before = loadSettings()
    const next = saveSettings(patch ?? {})
    // Menü bei Sprachwechsel neu aufbauen
    if (next.language !== before.language) buildMenu(next.language)
    // Backup-Intervall geändert → Prüfung neu starten
    if (next.autoBackup !== before.autoBackup) startAutoBackup()
    return next
  })

  // ── Datenbank: ein Kanal, strikte Allowlist ───────────────────────────────
  handle(IpcChannels.dbCall, (ns: unknown, method: unknown, args: unknown) => {
    const allowed = dbMethodNames[ns as keyof DbContract] as string[] | undefined
    if (!allowed || typeof method !== 'string' || !allowed.includes(method) || !Array.isArray(args)) {
      throw new DbError('VALIDATION', 'Unknown method')
    }
    // Typprüfung: die Repositories müssen den geteilten Vertrag erfüllen
    const repos: DbContract = getRepos()
    const target = repos[ns as keyof DbContract] as unknown as Record<string, (...a: unknown[]) => unknown>
    return target[method].apply(target, args)
  })

  // ── Archiv: Info, Backup, Export, Wiederherstellung ──────────────────────
  handle(IpcChannels.archiveInfo, () => dbInfo())

  handle(IpcChannels.archiveBackupNow, () => backupTo(undefined, 'manual'))

  handle(IpcChannels.archiveExport, async () => {
    const win = BrowserWindow.getFocusedWindow()
    const opts = {
      defaultPath: `${backupDir()}/${backupFileName('manual')}`,
      filters: [{ name: 'DocForge Backup', extensions: ['dfdb'] }]
    }
    const r = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
    if (r.canceled || !r.filePath) return null
    const target = r.filePath.endsWith('.dfdb') ? r.filePath : `${r.filePath}.dfdb`
    return backupTo(target, 'manual')
  })

  handle(IpcChannels.archiveRestore, async () => {
    const win = BrowserWindow.getFocusedWindow()
    const opts = {
      defaultPath: backupDir(),
      properties: ['openFile'] as 'openFile'[],
      filters: [{ name: 'DocForge Backup', extensions: ['dfdb'] }]
    }
    const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    if (r.canceled || !r.filePaths[0]) return null
    const result = await restoreFrom(r.filePaths[0])
    notifyDbChanged()
    return result
  })

  handle(IpcChannels.archiveChooseBackupFolder, async () => {
    const win = BrowserWindow.getFocusedWindow()
    const opts = { defaultPath: backupDir(), properties: ['openDirectory', 'createDirectory'] as ('openDirectory' | 'createDirectory')[] }
    const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    if (r.canceled || !r.filePaths[0]) return null
    saveSettings({ backupFolder: r.filePaths[0] })
    return r.filePaths[0]
  })

  handle(IpcChannels.archiveOpenBackupFolder, async () => {
    await shell.openPath(backupDir())
  })

  // ── Fotos aus Datei übernehmen ───────────────────────────────────────────
  handle(IpcChannels.photoImport, async (profileId: unknown) => {
    const win = BrowserWindow.getFocusedWindow()
    const opts = { properties: ['openFile'] as 'openFile'[], filters: [{ name: 'Bilder', extensions: ['jpg', 'jpeg', 'png'] }] }
    const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    if (r.canceled || !r.filePaths[0]) return null
    const src = r.filePaths[0]
    const img = nativeImage.createFromPath(src)
    const { width, height } = img.getSize()
    if (!width || !height) throw new DbError('VALIDATION', 'Not an image')
    const format = /\.png$/i.test(extname(src)) ? 'png' : 'jpeg'
    const fileName = `${randomUUID()}.${format === 'png' ? 'png' : 'jpg'}`
    copyFileSync(src, join(dataPaths().photosDir, fileName))
    return getRepos().photos.create({ profileId: typeof profileId === 'number' ? profileId : null, fileName, width, height, format, label: null })
  })

  // Aufnahme aus dem Kamera-Studio: Bytes prüfen und als Datei im Fotoordner ablegen
  handle(IpcChannels.photoSaveCaptured, (input: unknown) => {
    const x = input as { data?: unknown; format?: unknown; width?: unknown; height?: unknown; profileId?: unknown; label?: unknown }
    const data = x?.data instanceof Uint8Array ? Buffer.from(x.data) : null
    const format = x?.format === 'png' ? 'png' : x?.format === 'jpeg' ? 'jpeg' : null
    const w = Number(x?.width), h = Number(x?.height)
    if (!data || !format || data.length > 80 * 1024 * 1024 || !(w > 0 && w <= 10000) || !(h > 0 && h <= 10000)) {
      throw new DbError('VALIDATION', 'Invalid photo')
    }
    // Signatur prüfen (PNG: 89 50 4E 47, JPEG: FF D8)
    const ok = format === 'png' ? data.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) : data[0] === 0xff && data[1] === 0xd8
    if (!ok) throw new DbError('VALIDATION', 'Invalid image data')
    const fileName = `${randomUUID()}.${format === 'png' ? 'png' : 'jpg'}`
    writeFileSync(join(dataPaths().photosDir, fileName), data)
    return getRepos().photos.create({
      profileId: typeof x.profileId === 'number' ? x.profileId : null,
      fileName,
      width: Math.round(w),
      height: Math.round(h),
      format,
      label: typeof x.label === 'string' ? x.label.slice(0, 100) : null
    })
  })

  ipcMain.handle(IpcChannels.cameraAccess, async () => {
    if (process.platform !== 'darwin') return true
    if (systemPreferences.getMediaAccessStatus('camera') === 'granted') return true
    return systemPreferences.askForMediaAccess('camera')
  })

  // ── Export ───────────────────────────────────────────────────────────────
  handle(IpcChannels.exportPdf, async (id: unknown) => {
    const doc = loadDoc(Number(id))
    const win = BrowserWindow.getFocusedWindow()
    const opts = { defaultPath: `${safeFileName(doc.title)}.pdf`, filters: [{ name: 'PDF', extensions: ['pdf'] }] }
    const r = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
    if (r.canceled || !r.filePath) return null
    await renderPdf(doc.id, r.filePath)
    getRepos().documents.markExported(doc.id)
    return r.filePath
  })

  handle(IpcChannels.exportDocx, async (id: unknown) => {
    const doc = loadDoc(Number(id))
    const win = BrowserWindow.getFocusedWindow()
    const opts = { defaultPath: `${safeFileName(doc.title)}.docx`, filters: [{ name: 'Word', extensions: ['docx'] }] }
    const r = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
    if (r.canceled || !r.filePath) return null
    writeFileSync(r.filePath, await buildDocx(doc.content, dataPaths().photosDir))
    getRepos().documents.markExported(doc.id)
    return r.filePath
  })

  // Print-Fenster: nur das Fenster, das gerade ein PDF erzeugt, bekommt "sein" Dokument
  ipcMain.handle(IpcChannels.printGetDoc, (e) => {
    const job = printJobFor(e.sender.id)
    if (!job) return null
    return { doc: loadDoc(job.documentId), lang: loadSettings().language }
  })
  ipcMain.on(IpcChannels.printReady, (e) => printJobFor(e.sender.id)?.ready())

  // ── KI-Befehlsleiste ──────────────────────────────────────────────────────
  handle(IpcChannels.aiStatus, () => keyStatus())
  handle(IpcChannels.aiSetKey, (key: unknown) => saveApiKey(key))
  handle(IpcChannels.aiRemoveKey, () => removeApiKey())
  handle(IpcChannels.aiTestKey, () => testKey(loadSettings().claudeModel))
  handle(IpcChannels.aiCancel, () => cancelRun())
  handle(IpcChannels.aiRun, async (input: unknown) => {
    const x = (input ?? {}) as { documentId?: unknown; command?: unknown; jobPosting?: unknown }
    const doc = loadDoc(Number(x.documentId))
    const result = await runCommand(
      { documentId: doc.id, command: String(x.command ?? ''), jobPosting: typeof x.jobPosting === 'string' ? x.jobPosting : null },
      doc.content,
      doc.language,
      loadSettings().claudeModel
    )
    // Nur Änderungen weitergeben, die sich auf das aktuelle Dokument anwenden lassen
    const { valid, invalid } = validateChanges(doc.content, result.changes)
    return { ...result, changes: valid, invalidCount: invalid }
  })

  handle(IpcChannels.archiveSeedDemo, () => {
    const repos = getRepos()
    if (repos.stats.get().profiles > 0) throw new DbError('IN_USE', 'Archive not empty')
    seedDemo(repos)
  })
}
