/** Notizen, Termine, Fotos, Tags und Statistik. */
import { existsSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import type { Db } from '../connection'
import {
  applicationStatuses,
  eventInput,
  noteInput,
  tagEntities,
  type ArchiveStats,
  type ApplicationStatus,
  type EventInput,
  type EventItem,
  type Note,
  type NoteInput,
  type Photo,
  type TagCount,
  type TagEntity
} from '@shared/models'
import { DbError } from '../errors'
import { assertId, camel, mustExist, n, now, parse, setTags, tagsFor } from './util'

export function notesRepo(db: Db) {
  const get = (id: number): Note =>
    camel(mustExist(db.prepare('SELECT * FROM notes WHERE id = ?').get(assertId(id)) as Record<string, unknown>))
  return {
    list(parent: { applicationId?: number; companyId?: number }): Note[] {
      if (parent.applicationId)
        return (db.prepare('SELECT * FROM notes WHERE application_id = ? ORDER BY created_at').all(assertId(parent.applicationId)) as Record<string, unknown>[]).map((r) => camel<Note>(r))
      if (parent.companyId)
        return (db.prepare('SELECT * FROM notes WHERE company_id = ? ORDER BY created_at').all(assertId(parent.companyId)) as Record<string, unknown>[]).map((r) => camel<Note>(r))
      throw new DbError('VALIDATION', 'Missing parent')
    },
    create(input: NoteInput): Note {
      const x = parse(noteInput, input)
      const ts = now()
      const info = db
        .prepare('INSERT INTO notes (application_id, company_id, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .run(n(x.applicationId), n(x.companyId), x.body, ts, ts)
      return get(Number(info.lastInsertRowid))
    },
    update(id: number, body: string): Note {
      get(id)
      const b = String(body ?? '').trim()
      if (!b || b.length > 20_000) throw new DbError('VALIDATION', 'Invalid body')
      db.prepare('UPDATE notes SET body = ?, updated_at = ? WHERE id = ?').run(b, now(), id)
      return get(id)
    },
    remove(id: number): void {
      db.prepare('DELETE FROM notes WHERE id = ?').run(assertId(id))
    }
  }
}

export function eventsRepo(db: Db) {
  const get = (id: number): EventItem =>
    camel(mustExist(db.prepare('SELECT * FROM events WHERE id = ?').get(assertId(id)) as Record<string, unknown>))
  return {
    list(applicationId: number): EventItem[] {
      return (db.prepare('SELECT * FROM events WHERE application_id = ? ORDER BY starts_at').all(assertId(applicationId)) as Record<string, unknown>[]).map((r) => camel<EventItem>(r))
    },
    /** Anstehende Termine über alle Bewerbungen (für den Hub). */
    upcoming(limit = 10): (EventItem & { companyName: string; role: string })[] {
      const today = new Date().toISOString().slice(0, 10)
      return (
        db
          .prepare(
            `SELECT e.*, c.name AS company_name, a.role FROM events e
             JOIN applications a ON a.id = e.application_id JOIN companies c ON c.id = a.company_id
             WHERE e.starts_at >= ? ORDER BY e.starts_at LIMIT ?`
          )
          .all(today, Math.min(Math.max(1, limit), 100)) as Record<string, unknown>[]
      ).map((r) => camel(r))
    },
    create(input: EventInput): EventItem {
      const e = parse(eventInput, input)
      const info = db
        .prepare(
          'INSERT INTO events (application_id, kind, title, starts_at, location, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .run(e.applicationId, e.kind, n(e.title), e.startsAt, n(e.location), n(e.notes), now())
      return get(Number(info.lastInsertRowid))
    },
    update(id: number, input: Partial<EventInput>): EventItem {
      const e = parse(eventInput, { ...get(id), ...input })
      db.prepare('UPDATE events SET kind=?, title=?, starts_at=?, location=?, notes=? WHERE id=?').run(
        e.kind,
        n(e.title),
        e.startsAt,
        n(e.location),
        n(e.notes),
        id
      )
      return get(id)
    },
    remove(id: number): void {
      db.prepare('DELETE FROM events WHERE id = ?').run(assertId(id))
    }
  }
}

export function photosRepo(db: Db, photosDir: string) {
  return {
    list(profileId?: number | null): Photo[] {
      const rows = (
        profileId
          ? db.prepare('SELECT * FROM photos WHERE profile_id = ? ORDER BY created_at DESC').all(assertId(profileId))
          : db.prepare('SELECT * FROM photos ORDER BY created_at DESC').all()
      ) as Record<string, unknown>[]
      const tags = tagsFor(db, 'photo', rows.map((r) => r.id as number))
      return rows.map((r) => ({ ...camel<Photo>(r), tags: tags.get(r.id as number) ?? [] }))
    },
    /** Löscht Datensatz und Bilddatei. */
    remove(id: number): void {
      const row = mustExist(db.prepare('SELECT file_name FROM photos WHERE id = ?').get(assertId(id)) as { file_name: string } | undefined)
      db.prepare('DELETE FROM photos WHERE id = ?').run(id)
      const file = join(photosDir, row.file_name)
      if (existsSync(file)) unlinkSync(file)
    }
  }
}

export function tagsRepo(db: Db) {
  const checkEntity = (e: unknown): TagEntity => {
    if (!tagEntities.includes(e as TagEntity)) throw new DbError('VALIDATION', 'Invalid entity')
    return e as TagEntity
  }
  return {
    /** Alle Tags (optional pro Entitätstyp) mit Anzahl. */
    list(entity?: TagEntity): TagCount[] {
      const rows = entity
        ? db
            .prepare(
              `SELECT t.name, COUNT(*) AS count FROM tags t JOIN taggings tg ON tg.tag_id = t.id
               WHERE tg.entity_type = ? GROUP BY t.id ORDER BY count DESC, t.name`
            )
            .all(checkEntity(entity))
        : db
            .prepare(
              `SELECT t.name, COUNT(*) AS count FROM tags t JOIN taggings tg ON tg.tag_id = t.id
               GROUP BY t.id ORDER BY count DESC, t.name`
            )
            .all()
      return rows as TagCount[]
    },
    set(entity: TagEntity, id: number, names: string[]): string[] {
      return setTags(db, checkEntity(entity), assertId(id), names)
    }
  }
}

export function statsRepo(db: Db) {
  return {
    get(profileId?: number | null): ArchiveStats {
      const pid = profileId ? assertId(profileId) : null
      const byStatus = Object.fromEntries(applicationStatuses.map((s) => [s, 0])) as Record<ApplicationStatus, number>
      for (const r of db
        .prepare('SELECT status, COUNT(*) AS c FROM applications WHERE ? IS NULL OR profile_id = ? GROUP BY status')
        .all(pid, pid) as { status: ApplicationStatus; c: number }[]) {
        byStatus[r.status] = r.c
      }
      const count = (sql: string) => (db.prepare(sql).get(pid, pid) as { c: number }).c
      return {
        applications: Object.values(byStatus).reduce((a, b) => a + b, 0),
        byStatus,
        documents: count('SELECT COUNT(*) AS c FROM documents WHERE ? IS NULL OR profile_id = ?'),
        photos: count('SELECT COUNT(*) AS c FROM photos WHERE ? IS NULL OR profile_id = ?'),
        companies: (db.prepare('SELECT COUNT(*) AS c FROM companies').get() as { c: number }).c,
        profiles: (db.prepare('SELECT COUNT(*) AS c FROM profiles').get() as { c: number }).c
      }
    }
  }
}
