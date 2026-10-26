/**
 * Tests der Datenschicht: Migrationen, Repositories, Suche/Filter, Versionen, Backup/Restore.
 */
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Electron-"app" für Backup/Pfade simulieren
let userData = ''
vi.mock('electron', () => ({
  app: { getPath: () => userData, getVersion: () => '1.0.0-test' }
}))
vi.mock('../../src/main/settings-store', () => ({ loadSettings: () => ({ backupFolder: '', autoBackup: 'off' }) }))

import { openDatabase, setDb } from '../../src/main/db/connection'
import { migrate, latestSchemaVersion, currentSchemaVersion } from '../../src/main/db/migrations'
import { createRepos } from '../../src/main/db/repos'
import { seedDemo } from '../../src/main/db/seed'
import { createBackup, inspectBackup } from '../../src/main/db/backup'
import { initDatabase, restoreFrom, getRepos, shutdownDatabase } from '../../src/main/db/service'

function freshDb() {
  const db = openDatabase(':memory:')
  migrate(db)
  return { db, r: createRepos(db, join(userData, 'photos')) }
}

beforeEach(() => {
  userData = mkdtempSync(join(tmpdir(), 'docforge-test-'))
})
afterEach(() => {
  shutdownDatabase()
  setDb(null)
  rmSync(userData, { recursive: true, force: true })
})

describe('Migrationen', () => {
  it('bringt eine leere DB auf die neueste Version und ist idempotent', () => {
    const db = openDatabase(':memory:')
    expect(migrate(db)).toEqual(Array.from({ length: latestSchemaVersion }, (_, i) => i + 1))
    expect(currentSchemaVersion(db)).toBe(latestSchemaVersion)
    expect(migrate(db)).toEqual([])
  })
})

describe('Repositories', () => {
  it('legt Profile/Firmen/Bewerbungen an und filtert nach Status, Tag und Suche', () => {
    const { r } = freshDb()
    seedDemo(r)
    expect(r.stats.get().applications).toBe(8)
    expect(r.applications.list({ statuses: ['sent'] })).toHaveLength(3)
    expect(r.applications.list({ tags: ['#wind'] }).map((a) => a.companyName)).toContain('Nordlicht Energie GmbH')
    // Suche ist Groß/klein- und Umlaut-tolerant
    expect(r.applications.list({ search: 'KÜSTEN' })).toHaveLength(1)
    // Suche findet auch Text in Notizen
    expect(r.applications.list({ search: 'homeoffice' })).toHaveLength(1)
    const row = r.applications.list({ search: 'nordlicht' })[0]
    expect(row.documents.length).toBe(2)
    expect(row.nextEvent?.kind).toBe('interview')
  })

  it('validiert Eingaben und meldet keine Werte im Fehler', () => {
    const { r } = freshDb()
    expect(() => r.profiles.create({ name: '' })).toThrow(/VALIDATION|Invalid fields: name/)
  })

  it('verhindert das Löschen einer Firma mit Bewerbungen', () => {
    const { r } = freshDb()
    const p = r.profiles.create({ name: 'Test' })
    const c = r.companies.create({ name: 'ACME' })
    r.applications.create({ profileId: p.id, companyId: c.id, role: 'Dev' })
    expect(() => r.companies.remove(c.id)).toThrow(/IN_USE/)
  })

  it('führt einen Versionsverlauf und stellt Versionen wieder her', () => {
    const { r } = freshDb()
    const p = r.profiles.create({ name: 'Test' })
    const d = r.documents.create({ profileId: p.id, type: 'cv', title: 'CV', content: { a: 1 } })
    r.documents.saveContent(d.id, { a: 2 }, 'manual edit')
    const restored = r.documents.restoreVersion(d.id, 1)
    expect(restored.currentVersion).toBe(3)
    expect(restored.content).toEqual({ a: 1 })
    expect(r.documents.versions(d.id).map((v) => v.version)).toEqual([3, 2, 1])
  })

  it('normalisiert Tags und räumt verwaiste Tags auf', () => {
    const { r } = freshDb()
    const c = r.companies.create({ name: 'ACME' })
    expect(r.tags.set('company', c.id, ['#Wind', 'wind', 'Hamburg City'])).toEqual(['hamburg-city', 'wind'])
    r.tags.set('company', c.id, [])
    expect(r.tags.list()).toEqual([])
  })
})

describe('Backup', () => {
  it('exportiert DB + Fotos in eine Datei und stellt sie wieder her', async () => {
    await initDatabase()
    seedDemo(getRepos())
    writeFileSync(join(userData, 'photos', 'p1.png'), Buffer.from([1, 2, 3]))
    const file = join(userData, 'test.dfdb')
    const { getDb } = await import('../../src/main/db/connection')
    await createBackup(getDb(), join(userData, 'photos'), file)
    expect(inspectBackup(file).schemaVersion).toBe(latestSchemaVersion)

    // Daten ändern, dann Backup zurückspielen
    getRepos().companies.create({ name: 'Neu nach Backup' })
    rmSync(join(userData, 'photos', 'p1.png'))
    const res = await restoreFrom(file)
    expect(existsSync(res.safetyBackup)).toBe(true)
    expect(getRepos().companies.list('Neu nach Backup')).toHaveLength(0)
    expect(getRepos().stats.get().applications).toBe(8)
    expect([...readFileSync(join(userData, 'photos', 'p1.png'))]).toEqual([1, 2, 3])
  })

  it('lehnt ungültige Dateien ab', () => {
    const bad = join(userData, 'bad.dfdb')
    writeFileSync(bad, 'kein sqlite')
    expect(() => inspectBackup(bad)).toThrow(/Not a SQLite file|BACKUP_INVALID/)
  })
})
