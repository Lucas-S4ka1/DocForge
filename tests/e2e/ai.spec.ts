/**
 * KI-Befehlsleiste gegen einen simulierten Claude-Server (keine echten Anfragen, keine Kosten):
 * Key speichern, Stellenanzeige, Befehl, Review, teilweise übernehmen, Versionsverlauf.
 */
import { expect, test } from '@playwright/test'
import { createServer, type Server } from 'node:http'
import { launch, seed } from './helpers'

const result = {
  summary: 'Anrede persönlicher, Betreff präzisiert.',
  changes: [
    { label: 'Anrede → persönlich', path: '/salutation', action: 'replace', new_value_json: JSON.stringify('Sehr geehrte Frau Hansen,') },
    { label: 'Betreff präzisiert', path: '/subject', action: 'replace', new_value_json: JSON.stringify('Bewerbung als Projektleiterin Onshore-Wind') },
    { label: 'Ungültig', path: '/style/accent', action: 'replace', new_value_json: JSON.stringify('#ff0000') }
  ],
  matched_keywords: ['Windparkprojekten'],
  missing_keywords: ['SAP PS']
}

let server: Server
const requests: { url: string; body: string }[] = []

test.beforeAll(async () => {
  server = createServer((req, res) => {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      requests.push({ url: req.url ?? '', body })
      res.setHeader('content-type', 'application/json')
      if (req.method === 'GET') return res.end(JSON.stringify({ id: 'claude-opus-5-5', type: 'model', display_name: 'Claude Opus 5.5', created_at: '2026-01-01T00:00:00Z' }))
      res.end(
        JSON.stringify({
          id: 'msg_test',
          type: 'message',
          role: 'assistant',
          model: 'claude-opus-5-5',
          content: [{ type: 'text', text: JSON.stringify(result) }],
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: { input_tokens: 1, output_tokens: 1 }
        })
      )
    })
  })
  await new Promise<void>((r) => server.listen(47124, '127.0.0.1', () => r()))
})
test.afterAll(() => server.close())

test('Befehl ausführen, Änderungen prüfen und teilweise übernehmen', async () => {
  const { win, close } = await launch([], {
    DOCFORGE_AI_BASE_URL: 'http://127.0.0.1:47124',
    DOCFORGE_TEST_INSECURE_KEYSTORE: '1',
    NO_PROXY: '127.0.0.1'
  })
  try {
    await seed(win)
    await win.click('main button:has-text("Nordlicht Energie GmbH")')
    await win.click('button:has-text("+ Anschreiben")')
    await expect(win.locator('text=eigenen Claude-API-Key')).toBeVisible()

    await win.click('button:has-text("Key eintragen")')
    await expect(win.locator('text=Wer zahlt?')).toBeVisible() // Kostenhinweis
    await win.fill('input[placeholder="sk-ant-…"]', 'sk-ant-api03-TESTKEY0000000000000000000000abcd')
    await win.click('form button:has-text("Speichern")')
    await expect(win.locator('text=Key gespeichert')).toBeVisible()

    await win.click('nav button:has-text("Editor")')
    await win.fill('input[aria-label="Befehl eingeben …"]', 'Mach es persönlicher')
    await win.press('input[aria-label="Befehl eingeben …"]', 'Enter')
    await expect(win.locator('text=Alle übernehmen')).toBeVisible({ timeout: 20_000 })
    // Ungültige Änderung (Gestaltung) wurde aussortiert
    await expect(win.locator('aside button[aria-label="Auslassen"]')).toHaveCount(2)

    await win.locator('aside button[aria-label="Auslassen"]').nth(1).click() // Betreff auslassen
    await win.click('button:has-text("Auswahl übernehmen")')
    await expect(win.locator('.df-doc')).toContainText('Sehr geehrte Frau Hansen,')
    await expect(win.locator('.df-doc')).toContainText('Bewerbung als …')

    await win.click('button:has-text("[ Verlauf ]")')
    await expect(win.locator('text=„Mach es persönlicher“')).toBeVisible()

    // Gesendet wurde nur Text: weder Foto noch Gestaltung
    const sent = requests.find((r) => r.url.startsWith('/v1/messages'))!
    expect(sent.body).not.toContain('docforge-photo')
    expect(JSON.parse(sent.body).messages[0].content).not.toContain('"style"')
  } finally {
    await close()
  }
})
