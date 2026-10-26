/**
 * Datenbank-Verbindung und Dateipfade.
 * Alles liegt im Nutzerdatenordner: archive.db (SQLite), photos/ (Bilddateien), backups/.
 */
import Database from 'better-sqlite3'
import { app } from 'electron'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

export type Db = Database.Database

export function dataPaths() {
  const root = app.getPath('userData')
  return {
    root,
    dbFile: join(root, 'archive.db'),
    photosDir: join(root, 'photos'),
    defaultBackupsDir: join(root, 'backups')
  }
}

/** Öffnet eine SQLite-Datei mit den Standard-Einstellungen von DocForge. */
export function openDatabase(file: string): Db {
  const db = new Database(file)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 3000')
  // Unicode-fähiges Kleinschreiben für die Suche (SQLite-LOWER kann keine Umlaute)
  db.function('fold', { deterministic: true }, (s: unknown) =>
    s == null ? null : String(s).toLocaleLowerCase('de-DE')
  )
  return db
}

let current: Db | null = null

export function setDb(db: Db | null): void {
  current = db
}

export function getDb(): Db {
  if (!current) throw new Error('Database not open')
  return current
}

export function closeDb(): void {
  if (current) {
    try {
      current.pragma('wal_checkpoint(TRUNCATE)')
    } catch {
      /* ignorieren – close() schreibt das WAL ohnehin zurück */
    }
    current.close()
    current = null
  }
}

export function ensureDirs(): void {
  const p = dataPaths()
  mkdirSync(p.root, { recursive: true })
  mkdirSync(p.photosDir, { recursive: true })
}
