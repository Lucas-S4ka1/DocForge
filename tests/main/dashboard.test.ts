/**
 * Tests: Migration v1 → v2 mit bestehenden Daten, Quests, Hinweise, Wochenverlauf.
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ app: { getPath: () => '/tmp', getVersion: () => 'test' } }))

import { openDatabase } from '../../src/main/db/connection'
import { migrate, migrations, currentSchemaVersion } from '../../src/main/db/migrations'
import { createRepos } from '../../src/main/db/repos'
import { dashboardRepo, weekStart } from '../../src/main/db/repos/dashboard'
import { createContent, type CvContent, type LetterContent } from '../../src/shared/document'

describe('Migration v1 → v2', () => {
  it('behält bestehende Daten und ergänzt die neue Spalte', () => {
    const db = openDatabase(':memory:')
    // Stand einer installierten 1.x-Version simulieren: nur Migration 1
    db.transaction(() => {
      migrations[0].up(db)
      db.pragma('user_version = 1')
    })()
    db.prepare("INSERT INTO profiles (name, created_at, updated_at) VALUES ('Alt', 'x', 'x')").run()
    db.prepare("INSERT INTO documents (profile_id, type, title, created_at, updated_at) VALUES (1, 'cv', 'Alter CV', 'x', 'x')").run()
    expect(migrate(db)).toEqual([2])
    expect(currentSchemaVersion(db)).toBe(2)
    const row = db.prepare('SELECT title, last_exported_at FROM documents').get() as { title: string; last_exported_at: string | null }
    expect(row).toEqual({ title: 'Alter CV', last_exported_at: null })
  })
})

describe('Hub-Auswertung', () => {
  function setup() {
    const db = openDatabase(':memory:')
    migrate(db)
    const r = createRepos(db, '/tmp')
    const p = r.profiles.create({ name: 'Erika Muster', email: 'e@x.de' })
    const c = r.companies.create({ name: 'ACME' })
    return { db, r, p, c }
  }
  const now = new Date('2026-10-28T12:00:00')

  it('berechnet Quest-Schritte und den nächsten offenen Schritt', () => {
    const { db, r, p, c } = setup()
    const a = r.applications.create({ profileId: p.id, companyId: c.id, role: 'Dev', jobPosting: 'Wir suchen …' })
    const cv = createContent('cv', p, 'de') as CvContent
    cv.sections[1].entries[0].title = 'Entwicklerin'
    cv.sections[2].entries[0].title = 'B.Sc. Informatik'
    cv.sections[3].items[0].name = 'TypeScript'
    const cvDoc = r.documents.create({ profileId: p.id, applicationId: a.id, type: 'cv', title: 'CV', content: cv })
    const letter = createContent('cover_letter', p, 'de', 'ACME') as LetterContent
    letter.subject = 'Bewerbung als Entwicklerin'
    letter.body = 'x'.repeat(250)
    r.documents.create({ profileId: p.id, applicationId: a.id, type: 'cover_letter', title: 'Anschreiben', content: letter })

    let q = dashboardRepo(db).compute(p.id, 3, now).quests[0]
    expect(q.steps.filter((s) => s.done).map((s) => s.key)).toEqual(['cv', 'letter', 'posting'])
    expect(q.next).toBe('photo')
    expect(q.pct).toBe(50)

    r.documents.markExported(cvDoc.id)
    r.applications.update(a.id, { status: 'sent', sentAt: '2026-10-27' })
    q = dashboardRepo(db).compute(p.id, 3, now).quests[0]
    expect(q.steps.find((s) => s.key === 'export')?.done).toBe(true)
    expect(q.steps.find((s) => s.key === 'sent')?.done).toBe(true)
  })

  it('erzeugt Nachfass-, Termin- und Backup-Hinweise', () => {
    const { db, r, p, c } = setup()
    const old = r.applications.create({ profileId: p.id, companyId: c.id, role: 'Alt', status: 'sent', sentAt: '2026-10-01' })
    const fresh = r.applications.create({ profileId: p.id, companyId: c.id, role: 'Neu', status: 'interview', sentAt: '2026-10-20' })
    r.events.create({ applicationId: fresh.id, kind: 'interview', startsAt: '2026-10-30T10:00' })
    const n = dashboardRepo(db).compute(p.id, 3, now).notices
    expect(n.find((x) => x.kind === 'followup')).toMatchObject({ applicationId: old.id, days: 27 })
    expect(n.find((x) => x.kind === 'event')).toMatchObject({ applicationId: fresh.id, eventKind: 'interview' })
    expect(n.find((x) => x.kind === 'backup')).toEqual({ kind: 'backup', days: null })
  })

  it('zählt gesendete Bewerbungen pro Woche (Montag als Wochenbeginn)', () => {
    const { db, r, p, c } = setup()
    for (const d of ['2026-10-26', '2026-10-27', '2026-10-19', '2026-09-01']) r.applications.create({ profileId: p.id, companyId: c.id, role: 'x', status: 'sent', sentAt: d })
    const h = dashboardRepo(db).compute(p.id, 2, now)
    expect(weekStart(now)).toBe('2026-10-26')
    expect(h.weekly).toHaveLength(8)
    expect(h.weekly.at(-1)).toEqual({ weekStart: '2026-10-26', sent: 2 })
    expect(h.weekly.at(-2)).toEqual({ weekStart: '2026-10-19', sent: 1 })
    expect(h.thisWeekSent).toBe(2)
    expect(h.achievements.find((a) => a.key === 'weeklyGoal')?.done).toBe(true)
  })
})
