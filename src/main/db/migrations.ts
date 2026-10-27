/**
 * Versionierte Datenbank-Migrationen.
 *
 * Regeln:
 * - Jede Migration bekommt eine fortlaufende Versionsnummer und wird NIE nachträglich geändert.
 * - Schemaänderungen immer als NEUE Migration anhängen.
 * - Die aktuelle Version steht in `PRAGMA user_version`.
 * - Jede Migration läuft in einer Transaktion: entweder ganz oder gar nicht.
 */
import type Database from 'better-sqlite3'

export interface Migration {
  version: number
  name: string
  up(db: Database.Database): void
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial schema',
    up: (db) =>
      db.exec(`
        CREATE TABLE app_meta (
          key   TEXT PRIMARY KEY,
          value TEXT
        );

        CREATE TABLE profiles (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          name       TEXT NOT NULL,
          headline   TEXT,
          email      TEXT,
          phone      TEXT,
          address    TEXT,
          city       TEXT,
          birth_date TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE companies (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          name          TEXT NOT NULL,
          industry      TEXT,
          address       TEXT,
          city          TEXT,
          website       TEXT,
          contact_name  TEXT,
          contact_email TEXT,
          created_at    TEXT NOT NULL,
          updated_at    TEXT NOT NULL
        );

        CREATE TABLE applications (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          profile_id  INTEGER NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
          company_id  INTEGER NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
          role        TEXT NOT NULL,
          location    TEXT,
          status      TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','sent','interview','rejected','accepted')),
          job_posting TEXT,
          job_url     TEXT,
          sent_at     TEXT,
          created_at  TEXT NOT NULL,
          updated_at  TEXT NOT NULL
        );
        CREATE INDEX idx_applications_profile ON applications(profile_id);
        CREATE INDEX idx_applications_company ON applications(company_id);
        CREATE INDEX idx_applications_status  ON applications(status);

        CREATE TABLE documents (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          profile_id      INTEGER NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
          application_id  INTEGER REFERENCES applications(id) ON DELETE SET NULL,
          type            TEXT NOT NULL CHECK (type IN ('cv','cover_letter','cover_page','free')),
          title           TEXT NOT NULL,
          language        TEXT NOT NULL DEFAULT 'de',
          template        TEXT NOT NULL DEFAULT 'classic',
          content         TEXT NOT NULL DEFAULT 'null',
          current_version INTEGER NOT NULL DEFAULT 1,
          created_at      TEXT NOT NULL,
          updated_at      TEXT NOT NULL
        );
        CREATE INDEX idx_documents_profile     ON documents(profile_id);
        CREATE INDEX idx_documents_application ON documents(application_id);
        CREATE INDEX idx_documents_updated     ON documents(updated_at DESC);

        CREATE TABLE document_versions (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
          version     INTEGER NOT NULL,
          content     TEXT NOT NULL,
          note        TEXT,
          created_at  TEXT NOT NULL,
          UNIQUE (document_id, version)
        );

        CREATE TABLE photos (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          profile_id INTEGER REFERENCES profiles(id) ON DELETE SET NULL,
          file_name  TEXT NOT NULL UNIQUE,
          width      INTEGER NOT NULL,
          height     INTEGER NOT NULL,
          format     TEXT NOT NULL CHECK (format IN ('png','jpeg')),
          label      TEXT,
          created_at TEXT NOT NULL
        );

        -- Verknüpfung Bewerbung ↔ Foto (welches Foto wurde mitgeschickt)
        CREATE TABLE application_photos (
          application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
          photo_id       INTEGER NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
          PRIMARY KEY (application_id, photo_id)
        );

        CREATE TABLE notes (
          id             INTEGER PRIMARY KEY AUTOINCREMENT,
          application_id INTEGER REFERENCES applications(id) ON DELETE CASCADE,
          company_id     INTEGER REFERENCES companies(id) ON DELETE CASCADE,
          body           TEXT NOT NULL,
          created_at     TEXT NOT NULL,
          updated_at     TEXT NOT NULL,
          CHECK (application_id IS NOT NULL OR company_id IS NOT NULL)
        );
        CREATE INDEX idx_notes_application ON notes(application_id);
        CREATE INDEX idx_notes_company     ON notes(company_id);

        CREATE TABLE events (
          id             INTEGER PRIMARY KEY AUTOINCREMENT,
          application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
          kind           TEXT NOT NULL CHECK (kind IN ('interview','deadline','follow_up','other')),
          title          TEXT,
          starts_at      TEXT NOT NULL,
          location       TEXT,
          notes          TEXT,
          created_at     TEXT NOT NULL
        );
        CREATE INDEX idx_events_application ON events(application_id);
        CREATE INDEX idx_events_starts      ON events(starts_at);

        CREATE TABLE tags (
          id   INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE
        );

        -- Polymorphe Tag-Zuordnung für alle Entitäten
        CREATE TABLE taggings (
          tag_id      INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
          entity_type TEXT NOT NULL CHECK (entity_type IN ('application','document','company','profile','photo')),
          entity_id   INTEGER NOT NULL,
          PRIMARY KEY (tag_id, entity_type, entity_id)
        );
        CREATE INDEX idx_taggings_entity ON taggings(entity_type, entity_id);

        -- Tag-Zuordnungen beim Löschen der Entität mit aufräumen
        CREATE TRIGGER trg_applications_untag AFTER DELETE ON applications
          BEGIN DELETE FROM taggings WHERE entity_type = 'application' AND entity_id = OLD.id; END;
        CREATE TRIGGER trg_documents_untag AFTER DELETE ON documents
          BEGIN DELETE FROM taggings WHERE entity_type = 'document' AND entity_id = OLD.id; END;
        CREATE TRIGGER trg_companies_untag AFTER DELETE ON companies
          BEGIN DELETE FROM taggings WHERE entity_type = 'company' AND entity_id = OLD.id; END;
        CREATE TRIGGER trg_profiles_untag AFTER DELETE ON profiles
          BEGIN DELETE FROM taggings WHERE entity_type = 'profile' AND entity_id = OLD.id; END;
        CREATE TRIGGER trg_photos_untag AFTER DELETE ON photos
          BEGIN DELETE FROM taggings WHERE entity_type = 'photo' AND entity_id = OLD.id; END;
      `)
  },
  {
    version: 2,
    name: 'export tracking for quests',
    up: (db) =>
      db.exec(`
        -- Wann wurde ein Dokument zuletzt als PDF/DOCX exportiert? (Quest "Als PDF exportiert")
        ALTER TABLE documents ADD COLUMN last_exported_at TEXT;
      `)
  }
]

/** Höchste bekannte Schemaversion dieses App-Builds. */
export const latestSchemaVersion = migrations[migrations.length - 1].version

export function currentSchemaVersion(db: Database.Database): number {
  return db.pragma('user_version', { simple: true }) as number
}

/**
 * Führt alle ausstehenden Migrationen aus. Gibt die Liste der ausgeführten Versionen zurück.
 * Wirft, wenn die Datenbank von einer NEUEREN App-Version stammt (kein Downgrade).
 */
export function migrate(db: Database.Database): number[] {
  const from = currentSchemaVersion(db)
  if (from > latestSchemaVersion) {
    throw new Error(`Schema version ${from} is newer than supported ${latestSchemaVersion}`)
  }
  const done: number[] = []
  for (const m of migrations) {
    if (m.version <= from) continue
    db.transaction(() => {
      m.up(db)
      db.pragma(`user_version = ${m.version}`)
    })()
    done.push(m.version)
    console.info(`[db] Migration ${m.version} (${m.name}) ausgeführt`)
  }
  return done
}

export function pendingMigrations(db: Database.Database): number {
  const v = currentSchemaVersion(db)
  return migrations.filter((m) => m.version > v).length
}
