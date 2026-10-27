/** Hub: Hinweise, Quests mit Direktaktion, Statistik. */
import { expect, test } from '@playwright/test'
import { launch, seed } from './helpers'

test('Quests und Hinweise erscheinen, Direktaktion öffnet den Editor', async () => {
  const { win, close } = await launch()
  try {
    await seed(win)
    await win.click('nav button:has-text("Hub")')
    await expect(win.locator('text=Willkommen zurück, Jana')).toBeVisible()
    await expect(win.locator('text=[ TERMIN ]')).toBeVisible()
    await expect(win.locator('text=Noch kein Backup')).toBeVisible()
    await expect(win.getByText('Wochenziel: 0 / 3 gesendet')).toBeVisible()
    await win.locator('button:has-text("Lebenslauf öffnen →")').first().click()
    await expect(win.locator('nav button[aria-current=page]')).toContainText('Editor')
  } finally {
    await close()
  }
})
