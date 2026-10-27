/**
 * PDF-Export: Das Dokument wird in einem unsichtbaren Fenster mit denselben
 * React-Vorlagen wie die A4-Vorschau gerendert und per printToPDF gedruckt.
 */
import { BrowserWindow } from 'electron'
import { join } from 'node:path'
import { writeFileSync } from 'node:fs'

/** Zuordnung Print-Fenster (webContents.id) → Dokument-ID */
const pending = new Map<number, { documentId: number; ready: () => void }>()

export function printJobFor(webContentsId: number) {
  return pending.get(webContentsId) ?? null
}

export async function renderPdf(documentId: number, target: string): Promise<void> {
  const win = new BrowserWindow({
    show: false,
    width: 900,
    height: 1200,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  try {
    const ready = new Promise<void>((resolve, reject) => {
      pending.set(win.webContents.id, { documentId, ready: resolve })
      setTimeout(() => reject(new Error('Print timeout')), 20_000)
    })
    const devUrl = process.env['ELECTRON_RENDERER_URL']
    if (devUrl) await win.loadURL(`${devUrl}#print`)
    else await win.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'print' })
    await ready
    const pdf = await win.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margins: { top: 0, bottom: 0, left: 0, right: 0 }
    })
    writeFileSync(target, pdf)
  } finally {
    pending.delete(win.webContents.id)
    win.destroy()
  }
}
