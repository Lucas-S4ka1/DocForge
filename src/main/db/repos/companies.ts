/** Firmen. */
import type { Db } from '../connection'
import { companyInput, type Company, type CompanyInput, type CompanyRow } from '@shared/models'
import { assertId, camel, guardForeignKey, likePattern, mustExist, n, now, parse, tagsFor, tagSearchCondition } from './util'

export function companiesRepo(db: Db) {
  const get = (id: number): Company =>
    camel(mustExist(db.prepare('SELECT * FROM companies WHERE id = ?').get(assertId(id)) as Record<string, unknown>))

  const params = (c: ReturnType<typeof companyInput.parse>) => ({
    name: c.name,
    industry: n(c.industry),
    address: n(c.address),
    city: n(c.city),
    website: n(c.website),
    contactName: n(c.contactName),
    contactEmail: n(c.contactEmail)
  })

  return {
    list(search?: string): CompanyRow[] {
      const q = search?.trim() ? likePattern(search) : null
      const rows = db
        .prepare(
          `SELECT c.*, (SELECT COUNT(*) FROM applications a WHERE a.company_id = c.id) AS application_count
           FROM companies c
           WHERE @q IS NULL OR fold(c.name) LIKE @q ESCAPE '\\' OR fold(c.city) LIKE @q ESCAPE '\\'
              OR fold(c.industry) LIKE @q ESCAPE '\\' OR fold(c.contact_name) LIKE @q ESCAPE '\\'
              OR ${tagSearchCondition('company', 'c')}
           ORDER BY c.name COLLATE NOCASE`
        )
        .all({ q }) as Record<string, unknown>[]
      const tags = tagsFor(db, 'company', rows.map((r) => r.id as number))
      return rows.map((r) => ({ ...camel<CompanyRow>(r), tags: tags.get(r.id as number) ?? [] }))
    },

    get,

    create(input: CompanyInput): Company {
      const c = parse(companyInput, input)
      const ts = now()
      const info = db
        .prepare(
          `INSERT INTO companies (name, industry, address, city, website, contact_name, contact_email, created_at, updated_at)
           VALUES (@name, @industry, @address, @city, @website, @contactName, @contactEmail, @ts, @ts)`
        )
        .run({ ...params(c), ts })
      return get(Number(info.lastInsertRowid))
    },

    update(id: number, input: Partial<CompanyInput>): Company {
      const c = parse(companyInput, { ...get(id), ...input })
      db.prepare(
        `UPDATE companies SET name=@name, industry=@industry, address=@address, city=@city, website=@website,
           contact_name=@contactName, contact_email=@contactEmail, updated_at=@ts WHERE id=@id`
      ).run({ ...params(c), id, ts: now() })
      return get(id)
    },

    /** Nur möglich, wenn keine Bewerbungen mehr an der Firma hängen. */
    remove(id: number): void {
      assertId(id)
      guardForeignKey(() => db.prepare('DELETE FROM companies WHERE id = ?').run(id))
    }
  }
}
