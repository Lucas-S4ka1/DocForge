/** Bewerbungen inkl. Suche, Status-, Profil- und Tag-Filter. */
import type { Db } from '../connection'
import {
  applicationFilter,
  applicationInput,
  type Application,
  type ApplicationFilter,
  type ApplicationInput,
  type ApplicationRow,
  type DocumentType,
  type EventKind
} from '@shared/models'
import { assertId, camel, likePattern, mustExist, n, now, parse, tagCondition, tagsFor, tagSearchCondition } from './util'

export function applicationsRepo(db: Db) {
  const get = (id: number): Application =>
    camel(mustExist(db.prepare('SELECT * FROM applications WHERE id = ?').get(assertId(id)) as Record<string, unknown>))

  /** Ergänzt Listenzeilen um Dokumente, Tags, Fotoanzahl und nächsten Termin. */
  function enrich(rows: Record<string, unknown>[]): ApplicationRow[] {
    const ids = rows.map((r) => r.id as number)
    const idsJson = JSON.stringify(ids)
    const tags = tagsFor(db, 'application', ids)

    const docs = new Map<number, ApplicationRow['documents']>()
    for (const d of db
      .prepare(
        `SELECT application_id, id, type, title, current_version AS version FROM documents
         WHERE application_id IN (SELECT value FROM json_each(?)) ORDER BY CASE type WHEN 'cv' THEN 0 WHEN 'cover_letter' THEN 1 WHEN 'cover_page' THEN 2 ELSE 3 END, updated_at DESC`
      )
      .all(idsJson) as { application_id: number; id: number; type: DocumentType; title: string; version: number }[]) {
      docs.set(d.application_id, [...(docs.get(d.application_id) ?? []), { id: d.id, type: d.type, title: d.title, version: d.version }])
    }

    const photos = new Map<number, number>()
    for (const p of db
      .prepare(
        `SELECT application_id, COUNT(*) AS c FROM application_photos
         WHERE application_id IN (SELECT value FROM json_each(?)) GROUP BY application_id`
      )
      .all(idsJson) as { application_id: number; c: number }[]) {
      photos.set(p.application_id, p.c)
    }

    const events = new Map<number, ApplicationRow['nextEvent']>()
    const today = new Date().toISOString().slice(0, 10)
    for (const e of db
      .prepare(
        `SELECT application_id, kind, MIN(starts_at) AS starts_at FROM events
         WHERE application_id IN (SELECT value FROM json_each(?)) AND starts_at >= ?
         GROUP BY application_id`
      )
      .all(idsJson, today) as { application_id: number; kind: EventKind; starts_at: string }[]) {
      events.set(e.application_id, { kind: e.kind, startsAt: e.starts_at })
    }

    return rows.map((r) => {
      const id = r.id as number
      return {
        ...camel<ApplicationRow>(r),
        documents: docs.get(id) ?? [],
        photoCount: photos.get(id) ?? 0,
        tags: tags.get(id) ?? [],
        nextEvent: events.get(id) ?? null
      }
    })
  }

  const write = (a: ReturnType<typeof applicationInput.parse>) => ({
    profileId: a.profileId,
    companyId: a.companyId,
    role: a.role,
    location: n(a.location),
    status: a.status,
    jobPosting: n(a.jobPosting),
    jobUrl: n(a.jobUrl),
    sentAt: n(a.sentAt)
  })

  return {
    list(filter: ApplicationFilter = {}): ApplicationRow[] {
      const f = parse(applicationFilter, filter)
      const where: string[] = []
      const params: Record<string, unknown> = {}

      if (f.search?.trim()) {
        params.q = likePattern(f.search)
        where.push(`(fold(a.role) LIKE @q ESCAPE '\\' OR fold(c.name) LIKE @q ESCAPE '\\'
          OR fold(a.location) LIKE @q ESCAPE '\\' OR fold(c.city) LIKE @q ESCAPE '\\'
          OR fold(a.job_posting) LIKE @q ESCAPE '\\'
          OR EXISTS (SELECT 1 FROM notes nt WHERE nt.application_id = a.id AND fold(nt.body) LIKE @q ESCAPE '\\')
          OR ${tagSearchCondition('application', 'a')})`)
      }
      if (f.statuses?.length) {
        params.statuses = JSON.stringify(f.statuses)
        where.push('a.status IN (SELECT value FROM json_each(@statuses))')
      }
      if (f.profileId) {
        params.profileId = f.profileId
        where.push('a.profile_id = @profileId')
      }
      if (f.companyId) {
        params.companyId = f.companyId
        where.push('a.company_id = @companyId')
      }
      f.tags?.forEach((t, i) => {
        params[`tag${i}`] = t.toLowerCase().replace(/^#/, '')
        where.push(tagCondition('application', 'a', `tag${i}`))
      })

      const rows = db
        .prepare(
          `SELECT a.*, c.name AS company_name, c.city AS company_city, p.name AS profile_name
           FROM applications a
           JOIN companies c ON c.id = a.company_id
           JOIN profiles p  ON p.id = a.profile_id
           ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
           ORDER BY a.updated_at DESC`
        )
        .all(params) as Record<string, unknown>[]
      return enrich(rows)
    },

    get,

    /** Einzelne Bewerbung als angereicherte Zeile (für das Detail-Panel). */
    getRow(id: number): ApplicationRow {
      const row = db
        .prepare(
          `SELECT a.*, c.name AS company_name, c.city AS company_city, p.name AS profile_name
           FROM applications a JOIN companies c ON c.id = a.company_id JOIN profiles p ON p.id = a.profile_id
           WHERE a.id = ?`
        )
        .get(assertId(id)) as Record<string, unknown> | undefined
      return enrich([mustExist(row)])[0]
    },

    create(input: ApplicationInput): Application {
      const a = parse(applicationInput, input)
      const ts = now()
      const info = db
        .prepare(
          `INSERT INTO applications (profile_id, company_id, role, location, status, job_posting, job_url, sent_at, created_at, updated_at)
           VALUES (@profileId, @companyId, @role, @location, @status, @jobPosting, @jobUrl, @sentAt, @ts, @ts)`
        )
        .run({ ...write(a), ts })
      return get(Number(info.lastInsertRowid))
    },

    update(id: number, input: Partial<ApplicationInput>): Application {
      const before = get(id)
      const a = parse(applicationInput, { ...before, ...input })
      // Beim ersten Wechsel auf "Gesendet" automatisch das Sendedatum setzen
      if (a.status === 'sent' && before.status === 'draft' && !a.sentAt) a.sentAt = now().slice(0, 10)
      db.prepare(
        `UPDATE applications SET profile_id=@profileId, company_id=@companyId, role=@role, location=@location,
           status=@status, job_posting=@jobPosting, job_url=@jobUrl, sent_at=@sentAt, updated_at=@ts WHERE id=@id`
      ).run({ ...write(a), id, ts: now() })
      return get(id)
    },

    /** Löscht Bewerbung inkl. Notizen/Termine; Dokumente bleiben erhalten (Verknüpfung wird gelöst). */
    remove(id: number): void {
      db.prepare('DELETE FROM applications WHERE id = ?').run(assertId(id))
    },

    attachPhoto(applicationId: number, photoId: number): void {
      db.prepare('INSERT OR IGNORE INTO application_photos (application_id, photo_id) VALUES (?, ?)').run(
        assertId(applicationId),
        assertId(photoId)
      )
    }
  }
}
