/**
 * Tests für den DOCX-Export aller Dokumenttypen.
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ nativeImage: { createFromPath: () => ({ getSize: () => ({ width: 0, height: 0 }) }) } }))

import { buildDocx } from '../../src/main/export/docx'
import { createContent } from '../../src/shared/document'
import type { DocumentType } from '../../src/shared/models'

const profile = { name: 'Erika Muster', headline: 'Bürokauffrau', email: 'e@example.com', phone: '0123', city: '12345 Musterstadt', address: 'Weg 1' }

describe('DOCX-Export', () => {
  for (const type of ['cv', 'cover_letter', 'cover_page', 'free'] as DocumentType[]) {
    it(`erzeugt eine gültige DOCX-Datei für ${type}`, async () => {
      const content = createContent(type, profile, 'de', 'Testwerk AG')
      const buf = await buildDocx(content, '/nonexistent')
      expect(buf.length).toBeGreaterThan(2000)
      expect(buf.subarray(0, 2).toString()).toBe('PK') // ZIP-Container
    })
  }
})
