/**
 * Gemeinsame Helfer für alle Repositories.
 */
import type { ZodType } from 'zod'
import { DbError } from '../errors'
import type { Db } from '../connection'
import { tagName, type TagEntity } from '@shared/models'

export const now = () => new Date().toISOString()

/** Validiert eine IPC-Eingabe; bei Fehler nur Feldnamen melden, keine Werte. */
export function parse<T>(schema: ZodType<T>, input: unknown): T {
  const r = schema.safeParse(input)
  if (!r.success) {
    const fields = [...new Set(r.error.issues.map((i) => i.path.join('.') || '(root)'))].join(', ')
    throw new DbError('VALIDATION', `Invalid fields: ${fields}`)
  }
  return r.data
}

export function assertId(id: unknown): number {
  if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) throw new DbError('VALIDATION', 'Invalid id')
  return id
}

/** Wandelt eine Suchanfrage in ein LIKE-Muster um (mit Escape für % und _). */
export function likePattern(search: string): string {
  return `%${search.toLocaleLowerCase('de-DE').replace(/[\\%_]/g, (c) => `\\${c}`)}%`
}

/** snake_case-Zeile → camelCase-Objekt. */
export function camel<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) out[k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())] = v
  return out as T
}

/** Optionales Feld → null (für SQL-Parameter). */
export const n = <T>(v: T | undefined): T | null => (v === undefined || v === '' ? null : v)

// ── Tags ────────────────────────────────────────────────────────────────────

export function tagsFor(db: Db, entity: TagEntity, ids: number[]): Map<number, string[]> {
  const map = new Map<number, string[]>()
  if (ids.length === 0) return map
  const rows = db
    .prepare(
      `SELECT tg.entity_id AS id, t.name FROM taggings tg JOIN tags t ON t.id = tg.tag_id
       WHERE tg.entity_type = ? AND tg.entity_id IN (SELECT value FROM json_each(?))
       ORDER BY t.name`
    )
    .all(entity, JSON.stringify(ids)) as { id: number; name: string }[]
  for (const r of rows) map.set(r.id, [...(map.get(r.id) ?? []), r.name])
  return map
}

export function setTags(db: Db, entity: TagEntity, id: number, names: unknown): string[] {
  if (!Array.isArray(names) || names.length > 50) throw new DbError('VALIDATION', 'Invalid tags')
  const clean = [...new Set(names.map((x) => parse(tagName, x)))]
  db.transaction(() => {
    db.prepare('DELETE FROM taggings WHERE entity_type = ? AND entity_id = ?').run(entity, id)
    const insTag = db.prepare('INSERT INTO tags (name) VALUES (?) ON CONFLICT(name) DO NOTHING')
    const getTag = db.prepare('SELECT id FROM tags WHERE name = ?')
    const link = db.prepare('INSERT INTO taggings (tag_id, entity_type, entity_id) VALUES (?, ?, ?)')
    for (const name of clean) {
      insTag.run(name)
      const tag = getTag.get(name) as { id: number }
      link.run(tag.id, entity, id)
    }
    // Verwaiste Tags entfernen
    db.prepare('DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM taggings)').run()
  })()
  return clean.sort()
}

/** SQL-Bedingung: Entität trägt den Tag (für Filter). */
export function tagCondition(entity: TagEntity, alias: string, param: string): string {
  return `EXISTS (SELECT 1 FROM taggings tg JOIN tags t ON t.id = tg.tag_id
          WHERE tg.entity_type = '${entity}' AND tg.entity_id = ${alias}.id AND t.name = @${param})`
}

/** SQL-Bedingung: irgendein Tag der Entität passt zur Suche. */
export function tagSearchCondition(entity: TagEntity, alias: string): string {
  return `EXISTS (SELECT 1 FROM taggings tg JOIN tags t ON t.id = tg.tag_id
          WHERE tg.entity_type = '${entity}' AND tg.entity_id = ${alias}.id AND t.name LIKE @q ESCAPE '\\')`
}

/** Prüft, ob ein Datensatz existiert, sonst NOT_FOUND. */
export function mustExist<T>(row: T | undefined): T {
  if (!row) throw new DbError('NOT_FOUND')
  return row
}

/** Übersetzt Fremdschlüssel-Fehler in IN_USE. */
export function guardForeignKey<T>(fn: () => T): T {
  try {
    return fn()
  } catch (e) {
    if (e instanceof Error && /FOREIGN KEY constraint failed/.test(e.message)) throw new DbError('IN_USE')
    throw e
  }
}
