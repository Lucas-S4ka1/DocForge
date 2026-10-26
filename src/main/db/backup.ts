/**
 * Backup & Wiederherstellung.
 *
 * Format ".dfdb": eine eigenständige SQLite-Datei = vollständige Kopie der Datenbank
 * plus zwei Zusatztabellen:
 *   backup_meta(key, value)   – Formatkennung, App-Version, Schemaversion, Zeitstempel
 *   backup_files(path, data)  – alle Fotodateien als BLOB
 * Dadurch ist ein Backup genau EINE Datei und mit jedem SQLite-Tool lesbar.
 */
import Database from 'better-sqlite3'
import { app } from 'electron'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import type { BackupResult } from '@shared/models'
import { DbError } from './errors'
import { latestSchemaVersion } from './migrations'
import type { Db } from './connection'

export const BACKUP_FORMAT = 'docforge-backup/1'
const AUTO_PREFIX = 'DocForge-auto-'
const KEEP_AUTO_BACKUPS = 10

/** Zeitstempel für Dateinamen: 2026-10-26_1432 */
function stamp(d = new Date()): string {
  const p = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

export function backupFileName(kind: 'manual' | 'auto' | 'pre-restore' | 'pre-migration' | 'pre-update'): string {
  return kind === 'auto' ? `${AUTO_PREFIX}${stamp()}.dfdb` : `DocForge-${kind}-${stamp()}.dfdb`
}

/** Nur einfache Dateinamen aus dem Fotoordner zulassen (Schutz vor Pfad-Tricks). */
const safeName = (name: string) => /^[A-Za-z0-9._-]{1,200}$/.test(name) && !name.startsWith('.')

/**
 * Erstellt ein vollständiges Backup (Datenbank + Fotos) als einzelne Datei.
 * Schreibt zuerst in eine temporäre Datei und benennt dann um (nie halbe Backups).
 */
export async function createBackup(db: Db, photosDir: string, target: string): Promise<BackupResult> {
  const tmp = `${target}.part`
  if (existsSync(tmp)) unlinkSync(tmp)
  await db.backup(tmp)

  const b = new Database(tmp)
  try {
    b.pragma('journal_mode = DELETE')
    b.exec(`
      CREATE TABLE backup_meta (key TEXT PRIMARY KEY, value TEXT);
      CREATE TABLE backup_files (path TEXT PRIMARY KEY, data BLOB NOT NULL);
    `)
    const createdAt = new Date().toISOString()
    const meta = b.prepare('INSERT INTO backup_meta (key, value) VALUES (?, ?)')
    meta.run('format', BACKUP_FORMAT)
    meta.run('app_version', app.getVersion())
    meta.run('schema_version', String(b.pragma('user_version', { simple: true })))
    meta.run('created_at', createdAt)

    if (existsSync(photosDir)) {
      const ins = b.prepare('INSERT INTO backup_files (path, data) VALUES (?, ?)')
      b.transaction(() => {
        for (const f of readdirSync(photosDir)) {
          if (!safeName(f)) continue
          const full = join(photosDir, f)
          if (statSync(full).isFile()) ins.run(`photos/${f}`, readFileSync(full))
        }
      })()
    }
    b.exec('VACUUM')
  } finally {
    b.close()
  }
  renameSync(tmp, target)
  return { path: target, sizeBytes: statSync(target).size, createdAt: new Date().toISOString() }
}

export interface BackupInspection {
  schemaVersion: number
  appVersion: string | null
  createdAt: string | null
}

/** Prüft eine .dfdb-Datei, ohne sie zu verändern. */
export function inspectBackup(file: string): BackupInspection {
  let b: Database.Database
  try {
    b = new Database(file, { readonly: true, fileMustExist: true })
  } catch {
    throw new DbError('BACKUP_INVALID', 'Not a SQLite file')
  }
  try {
    const hasMeta = b.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='backup_meta'").get()
    if (!hasMeta) throw new DbError('BACKUP_INVALID', 'Missing backup_meta')
    const meta = Object.fromEntries(
      (b.prepare('SELECT key, value FROM backup_meta').all() as { key: string; value: string }[]).map((r) => [r.key, r.value])
    )
    if (meta.format !== BACKUP_FORMAT) throw new DbError('BACKUP_INVALID', 'Unknown format')
    const ok = b.pragma('quick_check', { simple: true })
    if (ok !== 'ok') throw new DbError('BACKUP_INVALID', 'Integrity check failed')
    const schemaVersion = b.pragma('user_version', { simple: true }) as number
    if (schemaVersion > latestSchemaVersion) throw new DbError('BACKUP_TOO_NEW')
    return { schemaVersion, appVersion: meta.app_version ?? null, createdAt: meta.created_at ?? null }
  } catch (e) {
    // SQLite meldet beschädigte/fremde Dateien erst beim ersten Zugriff
    if (e instanceof DbError) throw e
    throw new DbError('BACKUP_INVALID', 'Not a SQLite file')
  } finally {
    b.close()
  }
}

/**
 * Bereitet eine Wiederherstellung vor: kopiert das Backup nach `stagingDb`,
 * entpackt die Fotos nach `stagingPhotos` und entfernt die Backup-Tabellen.
 * Die eigentliche Datei-Umschaltung macht der DB-Service (bei geschlossener DB).
 */
export function stageRestore(file: string, stagingDb: string, stagingPhotos: string): void {
  rmSync(stagingPhotos, { recursive: true, force: true })
  mkdirSync(stagingPhotos, { recursive: true })
  copyFileSync(file, stagingDb)
  const b = new Database(stagingDb)
  try {
    for (const row of b.prepare('SELECT path, data FROM backup_files').iterate() as Iterable<{ path: string; data: Buffer }>) {
      const name = basename(row.path)
      if (!row.path.startsWith('photos/') || !safeName(name)) continue
      writeFileSync(join(stagingPhotos, name), row.data)
    }
    b.exec('DROP TABLE backup_files; DROP TABLE backup_meta;')
    b.exec('VACUUM')
  } finally {
    b.close()
  }
}

/** Löscht alte automatische Backups, behält die neuesten N. */
export function pruneAutoBackups(dir: string): void {
  if (!existsSync(dir)) return
  const files = readdirSync(dir)
    .filter((f) => f.startsWith(AUTO_PREFIX) && f.endsWith('.dfdb'))
    .sort()
    .reverse()
  for (const f of files.slice(KEEP_AUTO_BACKUPS)) {
    try {
      unlinkSync(join(dir, f))
    } catch {
      /* Datei evtl. gesperrt – beim nächsten Mal erneut versuchen */
    }
  }
}
