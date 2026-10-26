/** Profile (mehrere Personen möglich). */
import type { Db } from '../connection'
import { profileInput, type Profile, type ProfileInput, type ProfileRow } from '@shared/models'
import { assertId, camel, guardForeignKey, likePattern, mustExist, n, now, parse, tagsFor, tagSearchCondition } from './util'

const select = `SELECT p.*,
  (SELECT COUNT(*) FROM applications a WHERE a.profile_id = p.id) AS application_count,
  (SELECT COUNT(*) FROM documents d WHERE d.profile_id = p.id)    AS document_count,
  (SELECT COUNT(*) FROM photos ph WHERE ph.profile_id = p.id)     AS photo_count
  FROM profiles p`

export function profilesRepo(db: Db) {
  const get = (id: number): Profile =>
    camel(mustExist(db.prepare('SELECT * FROM profiles WHERE id = ?').get(assertId(id)) as Record<string, unknown>))

  return {
    list(search?: string): ProfileRow[] {
      const q = search?.trim() ? likePattern(search) : null
      const rows = db
        .prepare(
          `${select} WHERE @q IS NULL OR fold(p.name) LIKE @q ESCAPE '\\' OR fold(p.headline) LIKE @q ESCAPE '\\'
             OR fold(p.city) LIKE @q ESCAPE '\\' OR ${tagSearchCondition('profile', 'p')}
           ORDER BY p.name COLLATE NOCASE`
        )
        .all({ q }) as Record<string, unknown>[]
      const tags = tagsFor(db, 'profile', rows.map((r) => r.id as number))
      return rows.map((r) => ({ ...camel<ProfileRow>(r), tags: tags.get(r.id as number) ?? [] }))
    },

    get,

    create(input: ProfileInput): Profile {
      const p = parse(profileInput, input)
      const ts = now()
      const info = db
        .prepare(
          `INSERT INTO profiles (name, headline, email, phone, address, city, birth_date, created_at, updated_at)
           VALUES (@name, @headline, @email, @phone, @address, @city, @birthDate, @ts, @ts)`
        )
        .run({
          name: p.name,
          headline: n(p.headline),
          email: n(p.email),
          phone: n(p.phone),
          address: n(p.address),
          city: n(p.city),
          birthDate: n(p.birthDate),
          ts
        })
      return get(Number(info.lastInsertRowid))
    },

    update(id: number, input: Partial<ProfileInput>): Profile {
      const p = parse(profileInput, { ...get(id), ...input })
      db.prepare(
        `UPDATE profiles SET name=@name, headline=@headline, email=@email, phone=@phone, address=@address,
           city=@city, birth_date=@birthDate, updated_at=@ts WHERE id=@id`
      ).run({
        id,
        name: p.name,
        headline: n(p.headline),
        email: n(p.email),
        phone: n(p.phone),
        address: n(p.address),
        city: n(p.city),
        birthDate: n(p.birthDate),
        ts: now()
      })
      return get(id)
    },

    /** Nur möglich, wenn keine Bewerbungen/Dokumente mehr am Profil hängen. */
    remove(id: number): void {
      assertId(id)
      guardForeignKey(() => db.prepare('DELETE FROM profiles WHERE id = ?').run(id))
    }
  }
}
