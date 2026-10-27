/** Kamera-Studio mit simulierter Kamera: Start nur nach Klick, Aufnahme, "Im Lebenslauf verwenden". */
import { expect, test } from '@playwright/test'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { launch, seed } from './helpers'

test('Foto aufnehmen und im Lebenslauf verwenden', async () => {
  const { win, userData, close } = await launch(['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'])
  try {
    await seed(win)
    await win.click('nav button:has-text("Studio")')
    // Kamera ist aus, bis geklickt wird
    await expect(win.locator('main, div').getByText('Kamera aus').first()).toBeVisible()
    await win.click('button:has-text("Kamera starten")')
    await expect(win.locator('header')).toContainText('lokal verarbeitet', { timeout: 15_000 })

    await win.click('button[role=radio]:has-text("Aus")') // Countdown aus
    await win.click('button[aria-label="Foto aufnehmen"]')
    await expect(win.locator('text=Foto gespeichert')).toBeVisible({ timeout: 30_000 })
    expect(readdirSync(join(userData, 'photos')).filter((f) => f.endsWith('.jpg'))).toHaveLength(1)

    await win.click('button:has-text("im Lebenslauf verwenden")')
    await expect(win.locator('nav button[aria-current=page]')).toContainText('Editor')
    await expect(win.locator('.df-doc img.df-photo')).toHaveCount(1)
  } finally {
    await close()
  }
})
