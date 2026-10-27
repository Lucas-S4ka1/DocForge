/** Archiv: Suche, Filter, Anlegen, Löschschutz, Backup & Wiederherstellung. */
import { expect, test } from '@playwright/test'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { launch, mockOpenDialog, seed } from './helpers'

test('Suche (umlaut-tolerant) und Tag-Filter', async () => {
  const { win, close } = await launch()
  try {
    await seed(win)
    const rows = win.locator('main button.grid')
    await expect(rows).toHaveCount(8)
    await win.fill('input[placeholder^="Firmen, Rollen"]', 'KÜSTEN')
    await expect(rows).toHaveCount(1)
    await win.fill('input[placeholder^="Firmen, Rollen"]', 'homeoffice') // steht nur in einer Notiz
    await expect(rows).toHaveCount(1)
    await win.fill('input[placeholder^="Firmen, Rollen"]', '')
    await win.click('button:has-text("#wind")')
    await expect(rows).toHaveCount(3)
  } finally {
    await close()
  }
})

test('Bewerbung mit neuer Firma anlegen; Firma mit Bewerbungen ist vor Löschen geschützt', async () => {
  const { win, close } = await launch()
  try {
    await seed(win)
    await win.click('main button:has-text("+ Bewerbung")')
    await win.getByLabel('Firmenname').fill('Testwerk AG')
    await win.getByLabel('Stelle / Rolle').fill('Projektleitung')
    await win.click('div[role=dialog] button:has-text("Anlegen")')
    await expect(win.locator('main button:has-text("Testwerk AG")')).toHaveCount(1)

    await win.click('button:has-text("Firmen")')
    await win.click('main button:has-text("Testwerk AG")')
    await win.click('section button:has-text("Löschen")')
    await expect(win.getByRole('dialog')).toContainText('noch Bewerbungen')
  } finally {
    await close()
  }
})

test('Backup und Wiederherstellung (inkl. Sicherheits-Backup)', async () => {
  const { app, win, userData, close } = await launch()
  try {
    await seed(win)
    await win.click('main button:has-text("Jetzt sichern")')
    await expect(win.locator('text=Backup erstellt')).toBeVisible()
    const backups = join(userData, 'backups')
    const file = join(backups, readdirSync(backups)[0])

    // Bewerbung löschen …
    await win.click('main button:has-text("Nordlicht Energie GmbH")')
    await win.click('section button:has-text("Löschen")')
    await win.click('div[role=dialog] button:has-text("Löschen")')
    await expect(win.locator('main button:has-text("Projektleiterin Onshore-Wind")')).toHaveCount(0)

    // … und aus dem Backup zurückholen
    await mockOpenDialog(app, file)
    await win.click('nav button:has-text("Settings")')
    await win.click('button:has-text("Aus Datei wiederherstellen")')
    await win.click('div[role=dialog] button:has-text("Datei auswählen")')
    await expect(win.locator('text=Backup wiederhergestellt')).toBeVisible()
    await win.click('nav button:has-text("Archiv")')
    await expect(win.locator('main button:has-text("Projektleiterin Onshore-Wind")')).toHaveCount(1)
    expect(readdirSync(backups).some((f) => f.includes('pre-restore'))).toBe(true)
    expect(existsSync(join(userData, 'archive.db'))).toBe(true)
  } finally {
    await close()
  }
})
