/**
 * Dokumente mit Versionsverlauf.
 * Jede Inhaltsänderung über `saveContent` erzeugt eine neue Version; alte Versionen
 * bleiben erhalten und können wiederhergestellt werden (erzeugt wiederum eine neue Version).
 */
import type { Db } from '../connection'
import {
  documentFilter,
  documentInput,
  documentMetaPatch,
  type DocumentFilter,
  type DocumentInput,
  type DocumentMetaPatch,
  type DocumentRecord,
  type DocumentRow,
  type DocumentVersion
} from '@shared/models'
import { DbError } from '../errors'
import { assertId, camel, likePattern, mustExist, n, now, parse, tagCondition, tagsFor, tagSearchCondition } from './util'

const MAX_CONTENT = 2_000_000

function toRecord(row: Record<string, unknown>): DocumentRecord {
  const r = camel<DocumentRecord & { content: string }>(row)
  return { ...r, content: JSON.parse(r.content) }
}

function serialize(content: unknown): string {
  const s = JSON.stringify(content ?? null)
  if (s.length > MAX_CONTENT) throw new DbError('VALIDATION', 'Content too large')
  return s
}

export function documentsRepo(db: Db) {
  const get = (id: number): DocumentRecord =>
    toRecord(mustExist(db.prepare('SELECT * FROM documents WHERE id = ?').get(assertId(id)) as Record<string, unknown>))

  const insertVersion = db.prepare(
    'INSERT INTO document_versions (document_id, version, content, note, created_at) VALUES (?, ?, ?, ?, ?)'
  )

  return {
    list(filter: DocumentFilter = {}): DocumentRow[] {
      const f = parse(documentFilter, filter)
      const where: string[] = []
      const params: Record<string, unknown> = {}
      if (f.search?.trim()) {
        params.q = likePattern(f.search)
        where.push(`(fold(d.title) LIKE @q ESCAPE '\\' OR fold(c.name) LIKE @q ESCAPE '\\'
          OR fold(d.content) LIKE @q ESCAPE '\\' OR ${tagSearchCondition('document', 'd')})`)
      }
      if (f.type) {
        params.type = f.type
        where.push('d.type = @type')
      }
      if (f.profileId) {
        params.profileId = f.profileId
        where.push('d.profile_id = @profileId')
      }
      if (f.applicationId) {
        params.applicationId = f.applicationId
        where.push('d.application_id = @applicationId')
      }
      f.tags?.forEach((t, i) => {
        params[`tag${i}`] = t.toLowerCase().replace(/^#/, '')
        where.push(tagCondition('document', 'd', `tag${i}`))
      })
      const rows = db
        .prepare(
          `SELECT d.id, d.profile_id, d.application_id, d.type, d.title, d.language, d.template,
                  d.current_version, d.created_at, d.updated_at,
                  p.name AS profile_name, c.name AS company_name
           FROM documents d
           JOIN profiles p ON p.id = d.profile_id
           LEFT JOIN applications a ON a.id = d.application_id
           LEFT JOIN companies c ON c.id = a.company_id
           ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
           ORDER BY d.updated_at DESC
           ${f.limit ? `LIMIT ${f.limit}` : ''}`
        )
        .all(params) as Record<string, unknown>[]
      const tags = tagsFor(db, 'document', rows.map((r) => r.id as number))
      return rows.map((r) => ({ ...camel<DocumentRow>(r), tags: tags.get(r.id as number) ?? [] }))
    },

    get,

    /** Neues Dokument inkl. Version 1. */
    create(input: DocumentInput): DocumentRecord {
      const d = parse(documentInput, input)
      const ts = now()
      const content = serialize(d.content ?? null)
      const id = db.transaction(() => {
        const info = db
          .prepare(
            `INSERT INTO documents (profile_id, application_id, type, title, language, template, content, current_version, created_at, updated_at)
             VALUES (@profileId, @applicationId, @type, @title, @language, @template, @content, 1, @ts, @ts)`
          )
          .run({ ...d, applicationId: n(d.applicationId), content, ts })
        const newId = Number(info.lastInsertRowid)
        insertVersion.run(newId, 1, content, 'created', ts)
        return newId
      })()
      return get(id)
    },

    /** Metadaten ändern (Titel, Vorlage, Verknüpfung …) – erzeugt keine neue Version. */
    updateMeta(id: number, patch: DocumentMetaPatch): DocumentRecord {
      const p = parse(documentMetaPatch, patch)
      const cur = get(id)
      db.prepare(
        `UPDATE documents SET application_id=@applicationId, type=@type, title=@title, language=@language,
           template=@template, updated_at=@ts WHERE id=@id`
      ).run({
        id,
        applicationId: p.applicationId === undefined ? cur.applicationId : p.applicationId,
        type: p.type ?? cur.type,
        title: p.title ?? cur.title,
        language: p.language ?? cur.language,
        template: p.template ?? cur.template,
        ts: now()
      })
      return get(id)
    },

    /** Speichert neuen Inhalt als neue Version. `note` beschreibt die Änderung (z. B. Befehl). */
    saveContent(id: number, content: unknown, note?: string | null): DocumentRecord {
      const cur = get(id)
      const s = serialize(content)
      const ts = now()
      const version = cur.currentVersion + 1
      db.transaction(() => {
        insertVersion.run(id, version, s, note ? String(note).slice(0, 300) : null, ts)
        db.prepare('UPDATE documents SET content=?, current_version=?, updated_at=? WHERE id=?').run(s, version, ts, id)
      })()
      return get(id)
    },

    versions(id: number): DocumentVersion[] {
      return (
        db
          .prepare('SELECT * FROM document_versions WHERE document_id = ? ORDER BY version DESC')
          .all(assertId(id)) as Record<string, unknown>[]
      ).map((r) => {
        const v = camel<DocumentVersion & { content: string }>(r)
        return { ...v, content: JSON.parse(v.content) }
      })
    },

    /** Stellt eine alte Version wieder her, indem sie als neue Version gespeichert wird. */
    restoreVersion(id: number, version: number): DocumentRecord {
      const row = mustExist(
        db.prepare('SELECT content FROM document_versions WHERE document_id = ? AND version = ?').get(assertId(id), version) as
          | { content: string }
          | undefined
      )
      return this.saveContent(id, JSON.parse(row.content), `restored v${version}`)
    },

    duplicate(id: number): DocumentRecord {
      const d = get(id)
      return this.create({
        profileId: d.profileId,
        applicationId: d.applicationId,
        type: d.type,
        title: `${d.title} (Kopie)`.slice(0, 200),
        language: d.language,
        template: d.template,
        content: d.content
      })
    },

    remove(id: number): void {
      db.prepare('DELETE FROM documents WHERE id = ?').run(assertId(id))
    }
  }
}
