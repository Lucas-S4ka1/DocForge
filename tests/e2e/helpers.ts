/**
 * Startet DocForge mit einem frischen, temporären Datenordner (keine echten Nutzerdaten).
 */
import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

export interface Launched {
  app: ElectronApplication
  win: Page
  userData: string
  close(): Promise<void>
}

export async function launch(extraArgs: string[] = [], env: Record<string, string> = {}): Promise<Launched> {
  const userData = mkdtempSync(join(tmpdir(), 'docforge-e2e-'))
  const electronPath = require('electron') as unknown as string
  const app = await electron.launch({
    executablePath: electronPath,
    args: [resolve('.'), '--no-sandbox', ...extraArgs],
    env: { ...process.env, DOCFORGE_TEST_USER_DATA: userData, ...env } as Record<string, string>
  })
  const win = await app.firstWindow()
  await win.setViewportSize({ width: 1440, height: 900 })
  await win.waitForSelector('nav')
  return {
    app,
    win,
    userData,
    close: async () => {
      await app.close()
      rmSync(userData, { recursive: true, force: true })
    }
  }
}

/** Beispieldaten über das Archiv laden. */
export async function seed(win: Page): Promise<void> {
  await win.click('nav button:has-text("Archiv")')
  await win.click('button:has-text("Beispieldaten laden")')
  await win.waitForSelector('button:has-text("Nordlicht Energie GmbH")')
}

/** Speichern-Dialog im Main-Process durch festen Pfad ersetzen. */
export async function mockSaveDialog(app: ElectronApplication, files: string[]): Promise<void> {
  await app.evaluate(({ dialog }, list) => {
    let i = 0
    dialog.showSaveDialog = (async () => ({ canceled: false, filePath: list[Math.min(i++, list.length - 1)] })) as typeof dialog.showSaveDialog
  }, files)
}

export async function mockOpenDialog(app: ElectronApplication, file: string): Promise<void> {
  await app.evaluate(({ dialog }, f) => {
    dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [f] })) as typeof dialog.showOpenDialog
  }, file)
}
