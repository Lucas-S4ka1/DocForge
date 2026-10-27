/** Grundfunktionen: Start, Navigation, Branding, Sprache, reduzierte Effekte. */
import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { launch } from './helpers'

const version = JSON.parse(readFileSync('package.json', 'utf8')).version as string

test('startet, zeigt Branding mit Version und navigiert durch alle Bereiche', async () => {
  const { win, close } = await launch()
  try {
    await expect(win.locator('nav')).toContainText(`Version ${version}`)
    await expect(win.locator('nav')).toContainText('produced by P.J. Works')
    for (const [nav, text] of [
      ['Editor', 'Kein Dokument geöffnet'],
      ['Studio', 'Kamera-Studio'],
      ['Archiv', 'Archiv'],
      ['Settings', 'Einstellungen'],
      ['Hub', 'Willkommen']
    ]) {
      await win.click(`nav button:has-text("${nav}")`)
      await expect(win.locator('main, header').first()).toContainText(text)
    }
  } finally {
    await close()
  }
})

test('Sprache umschalten und reduzierte Effekte bleiben nach Neustart erhalten', async () => {
  const first = await launch()
  await first.win.click('nav button:has-text("Settings")')
  await first.win.click('button[role=switch][aria-label="Reduzierte Effekte"]')
  await first.win.click('button:has-text("English")')
  await expect(first.win.locator('h1')).toHaveText(/Settings/i)
  expect(await first.win.evaluate(() => document.documentElement.dataset.fx)).toBe('reduced')
  const userData = first.userData
  await first.app.close()

  // Gleicher Datenordner → Einstellungen müssen erhalten sein
  const { _electron } = await import('@playwright/test')
  const app = await _electron.launch({
    executablePath: require('electron') as unknown as string,
    args: ['.', '--no-sandbox'],
    env: { ...process.env, DOCFORGE_TEST_USER_DATA: userData } as Record<string, string>
  })
  const win = await app.firstWindow()
  await win.waitForSelector('nav')
  expect(await win.evaluate(() => document.documentElement.lang)).toBe('en')
  expect(await win.evaluate(() => document.documentElement.dataset.fx)).toBe('reduced')
  await app.close()
})

test('Über-Fenster öffnet sich aus der Seitenleiste und schließt mit Escape', async () => {
  const { win, close } = await launch()
  try {
    await win.click('nav button[title]')
    await expect(win.getByRole('dialog')).toContainText(`Version ${version}`)
    await win.keyboard.press('Escape')
    await expect(win.getByRole('dialog')).toHaveCount(0)
  } finally {
    await close()
  }
})
