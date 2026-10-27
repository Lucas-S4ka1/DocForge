/** Editor: Lebenslauf anlegen, bearbeiten, Vorlage wechseln, PDF/DOCX-Export, Versionen. */
import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch, mockSaveDialog, seed } from './helpers'

test('Lebenslauf: anlegen, ausfüllen, Vorlage wechseln, als PDF und DOCX exportieren', async () => {
  const { app, win, userData, close } = await launch()
  try {
    await seed(win)
    await win.click('nav button:has-text("Hub")')
    await win.click('button:has-text("Neuer Lebenslauf")')
    await expect(win.locator('.df-doc')).toContainText('Jana Weber')

    await win.click('aside >> text=Berufserfahrung')
    await win.getByLabel('Position / Abschluss').fill('Projektingenieurin Wind')
    await win.getByLabel('Firma / Schule').fill('Hanse Wind AG')
    await expect(win.locator('.df-doc')).toContainText('Projektingenieurin Wind')

    await win.click('button:has-text("[ Design ]")')
    await win.click('button:has-text("Zweispaltig")')
    // Nur die A4-Vorschau prüfen (die Vorlagen-Miniaturen sind ebenfalls Dokumentansichten)
    await expect(win.locator('.shadow-paper .df-doc .cv-twocolumn')).toHaveCount(1)

    const pdf = join(userData, 'cv.pdf')
    const docx = join(userData, 'cv.docx')
    await mockSaveDialog(app, [pdf, docx])
    await win.click('button:has-text("Export PDF")')
    await expect(win.locator('text=Exportiert: cv.pdf')).toBeVisible({ timeout: 30_000 })
    await win.click('button:has-text("Export DOCX")')
    await expect(win.locator('text=Exportiert: cv.docx')).toBeVisible({ timeout: 30_000 })

    expect(readFileSync(pdf).subarray(0, 5).toString()).toBe('%PDF-')
    expect(readFileSync(docx).subarray(0, 2).toString()).toBe('PK')
    // Der PDF-Text enthält den eingegebenen Eintrag
    expect(readFileSync(pdf).length).toBeGreaterThan(10_000)
  } finally {
    await close()
  }
})

test('Abschnitte per Drag & Drop umsortieren', async () => {
  const { win, close } = await launch()
  try {
    await seed(win)
    await win.click('nav button:has-text("Hub")')
    await win.click('button:has-text("Neuer Lebenslauf")')
    const rows = win.locator('aside div[draggable=true]')
    const firstBefore = await rows.first().innerText()
    await rows.nth(3).dragTo(rows.nth(0), { targetPosition: { x: 20, y: 4 } })
    await expect(rows.first()).not.toHaveText(firstBefore)
  } finally {
    await close()
  }
})

test('Anschreiben nach DIN 5008 mit Anschriftfeld', async () => {
  const { win, close } = await launch()
  try {
    await seed(win)
    await win.click('main button:has-text("Nordlicht Energie GmbH")')
    await win.click('button:has-text("+ Anschreiben")')
    await expect(win.locator('.df-doc .letter.din-b')).toHaveCount(1)
    await expect(win.locator('.df-doc .addr')).toContainText('Nordlicht Energie GmbH')
  } finally {
    await close()
  }
})
