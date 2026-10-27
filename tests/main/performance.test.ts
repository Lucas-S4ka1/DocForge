/**
 * Lasttest: Archiv und Hub bleiben auch mit vielen Einträgen schnell
 * (Ziel: deutlich unter 300 ms pro Abfrage auf einem normalen Rechner).
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ app: { getPath: () => '/tmp', getVersion: () => 'test' } }))

import { openDatabase } from '../../src/main/db/connection'
import { migrate } from '../../src/main/db/migrations'
import { createRepos } from '../../src/main/db/repos'
import { createContent } from '../../src/shared/document'
import { applicationStatuses } from '../../src/shared/models'

describe('Leistung mit vielen Daten', () => {
  it('500 Bewerbungen, 1000 Dokumente: Liste, Suche und Hub sind schnell', () => {
    const db = openDatabase(':memory:')
    migrate(db)
    const r = createRepos(db, '/tmp')
    const p = r.profiles.create({ name: 'Last Test' })
    const cv = createContent('cv', p, 'de')
    db.transaction(() => {
      for (let i = 0; i < 500; i++) {
        const c = r.companies.create({ name: `Firma ${i}`, city: i % 2 ? 'Hamburg' : 'Köln' })
        const a = r.applications.create({ profileId: p.id, companyId: c.id, role: `Rolle ${i}`, status: applicationStatuses[i % 5], sentAt: `2026-${String((i % 9) + 1).padStart(2, '0')}-15` })
        r.tags.set('application', a.id, [`tag${i % 7}`])
        r.documents.create({ profileId: p.id, applicationId: a.id, type: 'cv', title: `CV ${i}`, content: cv })
        r.documents.create({ profileId: p.id, applicationId: a.id, type: 'cover_letter', title: `Brief ${i}`, content: null })
        r.notes.create({ applicationId: a.id, body: `Notiz ${i} mit Text` })
      }
    })()
    const time = (fn: () => unknown) => {
      const t0 = performance.now()
      fn()
      return performance.now() - t0
    }
    const list = time(() => expect(r.applications.list()).toHaveLength(500))
    const search = time(() => r.applications.list({ search: 'köln', tags: ['tag3'] }))
    const docs = time(() => r.documents.list({}))
    const hub = time(() => r.dashboard.get(p.id, 3))
    console.info(`[perf] Liste ${list.toFixed(0)} ms · Suche ${search.toFixed(0)} ms · Dokumente ${docs.toFixed(0)} ms · Hub ${hub.toFixed(0)} ms`)
    for (const ms of [list, search, docs, hub]) expect(ms).toBeLessThan(1500)
  })
})
