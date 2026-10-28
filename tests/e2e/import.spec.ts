/** Import: vorhandenen Word-/PDF-Lebenslauf einlesen, Vorlage wählen, im Editor ergänzen. */
import { expect, test } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { launch, mockOpenDialog } from './helpers'

test('Word-Lebenslauf importieren: Vorschau, Layout wählen, Profil + Foto übernehmen', async () => {
  const { app, win, close } = await launch()
  try {
    // Ganz neu, noch kein Profil – der Import legt es aus den erkannten Daten an
    await mockOpenDialog(app, resolve('tests/fixtures/lebenslauf-alt.docx'))
    await win.click('main button:has-text("Importieren")')

    const dialog = win.getByRole('dialog')
    await expect(dialog).toContainText('Dokument importieren')
    await expect(dialog).toContainText('lebenslauf-alt.docx')
    const found = dialog.getByTestId('import-found')
    await expect(found).toContainText('✓ Name')
    await expect(found).toContainText('Berufserfahrung · 2 Einträge')
    await expect(found).toContainText('Sprachen · 2 Einträge')
    await expect(dialog.getByLabel('Foto aus der Datei übernehmen')).toBeChecked()
    // Ausbildung wurde erkannt; Bewerbungsfoto kommt aus der Datei → nichts Wichtiges fehlt
    await expect(dialog).toContainText('Alles Wichtige ist vorhanden.')
    await expect(dialog.getByTestId('import-preview')).toContainText('Max Mustermann')

    // Layout wählen: Modern
    await dialog.locator('button:has-text("Modern")').click()
    await expect(dialog.getByTestId('import-preview').locator('.cv-modern')).toHaveCount(1)
    await dialog.locator('button:has-text("Übernehmen & bearbeiten")').click()

    // Editor ist offen, Inhalt übernommen
    await expect(win.locator('text=Importiert – prüfe den Inhalt')).toBeVisible()
    const page = win.locator('.shadow-paper .df-doc')
    await expect(page).toContainText('Max Mustermann')
    await expect(page).toContainText('Spedition Rhein GmbH')
    await expect(page).toContainText('Fachoberschulreife')
    await expect(win.locator('.shadow-paper .df-doc .cv-modern')).toHaveCount(1)
    await expect(page.locator('img')).toHaveCount(1) // Foto aus der Word-Datei

    // Profil wurde angelegt und ist aktiv
    await win.click('nav button:has-text("Archiv")')
    await win.click('button:has-text("Profile")')
    await expect(win.locator('main')).toContainText('Max Mustermann')

    // Lebenslauf einer anderen Person (PDF) → eigenes Profil anlegen
    await mockOpenDialog(app, resolve('tests/fixtures/cv-beispiel.pdf'))
    await win.click('nav button:has-text("Hub")')
    await win.click('main button:has-text("Importieren")')
    const other = win.getByRole('dialog').getByLabel(/„Jana Weber“ als neues Profil anlegen/)
    await expect(other).toBeChecked()
    await expect(win.getByRole('dialog').getByTestId('import-preview')).toContainText('Jana Weber')
    await win.getByRole('dialog').locator('button:has-text("Übernehmen & bearbeiten")').click()
    await expect(win.locator('.shadow-paper .df-doc')).toContainText('Hanse Wind AG')
    await win.click('nav button:has-text("Archiv")')
    await win.click('button:has-text("Profile")')
    await expect(win.locator('main')).toContainText('Jana Weber')
  } finally {
    await close()
  }
})

test('Anschreiben importieren und nicht lesbare Dateien sauber ablehnen', async () => {
  const { app, win, userData, close } = await launch()
  try {
    const letter = join(userData, 'anschreiben.txt')
    writeFileSync(
      letter,
      'Logistik Nord GmbH\nz. Hd. Frau Schneider\nHafenweg 5\n20457 Hamburg\n\nEssen, 02.09.2024\n\nBewerbung als Lagerleiter\n\nSehr geehrte Frau Schneider,\n\nmit großem Interesse habe ich Ihre Anzeige gelesen.\n\nMit freundlichen Grüßen\n\nMax Mustermann'
    )
    await mockOpenDialog(app, letter)
    await win.click('main button:has-text("Importieren")')
    const dialog = win.getByRole('dialog')
    // als Anschreiben erkannt
    await expect(dialog.getByRole('radio', { name: 'Anschreiben' })).toHaveAttribute('aria-checked', 'true')
    await expect(dialog.getByTestId('import-preview')).toContainText('Logistik Nord GmbH')
    await dialog.locator('button:has-text("Übernehmen & bearbeiten")').click()
    await expect(win.locator('.shadow-paper .df-doc')).toContainText('Bewerbung als Lagerleiter')

    // Alte .doc-Datei → verständliche Meldung statt Absturz
    const old = join(userData, 'alt.doc')
    writeFileSync(old, 'x')
    await mockOpenDialog(app, old)
    // diesmal über das Menü Datei → Dokument importieren … (Strg + O)
    await app.evaluate(({ Menu }) => {
      const items = Menu.getApplicationMenu()!.items.flatMap((i) => i.submenu?.items ?? [])
      items.find((i) => i.label === 'Dokument importieren …')!.click()
    })
    await expect(win.locator('text=Alte Word-Dateien (.doc) werden nicht unterstützt')).toBeVisible()
  } finally {
    await close()
  }
})
