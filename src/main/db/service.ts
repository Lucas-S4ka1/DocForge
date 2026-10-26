/**
 * DB-Service: Lebenszyklus der Datenbank.
 * - Start: öffnen → (bei ausstehenden Migrationen) Sicherheits-Backup → migrieren
 * - automatische Backups (täglich/wöchentlich) in den Backup-Ordner
 * - Export/Import von .dfdb-Backups inkl. sicherem Austausch der Dateien
 */
import { existsSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { BackupResult, DbInfo, RestoreResult } from '@shared/models'
import { loadSettings } from '../settings-store'
import { closeDb, dataPaths, ensureDirs, getDb, openDatabase, setDb } from './connection'
import { currentSchemaVersion, migrate, pendingMigrations } from './migrations'
import { backupFileName, createBackup, inspectBackup, pruneAutoBackups, stageRestore } from './backup'
import { createRepos, type Repos } from './repos'

let repos: Repos | null = null
let autoTimer: NodeJS.Timeout | null = null

export function getRepos(): Repos {
  if (!repos) throw new Error('Database not initialised')
  return repos
}

// ── Meta-Werte (in der Datenbank selbst) ───────────────────────────────────

function getMeta(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM app_meta WHERE key = ?').get(key) as { value: string } | undefined
  return row?.value ?? null
}
function setMeta(key: string, value: string): void {
  getDb().prepare('INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value)
}

export function backupDir(): string {
  const dir = loadSettings().backupFolder || dataPaths().defaultBackupsDir
  mkdirSync(dir, { recursive: true })
  return dir
}

/** Öffnet die Datenbank und führt Migrationen aus. Vorher wird bei Bedarf ein Backup angelegt. */
export async function initDatabase(): Promise<void> {
  ensureDirs()
  const { dbFile, photosDir } = dataPaths()
  const db = openDatabase(dbFile)
  setDb(db)

  // Bestehende Daten + ausstehende Migration (z. B. nach einem Update) → erst sichern
  if (currentSchemaVersion(db) > 0 && pendingMigrations(db) > 0) {
    await createBackup(db, photosDir, join(backupDir(), backupFileName('pre-migration')))
    console.info('[db] Sicherheits-Backup vor Migration erstellt')
  }
  migrate(db)
  repos = createRepos(db, photosDir)
}

export function shutdownDatabase(): void {
  if (autoTimer) clearInterval(autoTimer)
  autoTimer = null
  repos = null
  closeDb()
}

export function dbInfo(): DbInfo {
  const { dbFile } = dataPaths()
  const size = (f: string) => (existsSync(f) ? statSync(f).size : 0)
  return {
    path: dbFile,
    sizeBytes: size(dbFile) + size(`${dbFile}-wal`),
    schemaVersion: currentSchemaVersion(getDb()),
    lastBackupAt: getMeta('last_backup_at')
  }
}

/** Backup in eine Zieldatei (oder in den Backup-Ordner). */
export async function backupTo(target?: string, kind: Parameters<typeof backupFileName>[0] = 'manual'): Promise<BackupResult> {
  const file = target ?? join(backupDir(), backupFileName(kind))
  const result = await createBackup(getDb(), dataPaths().photosDir, file)
  setMeta('last_backup_at', result.createdAt)
  if (kind === 'auto') pruneAutoBackups(backupDir())
  return result
}

/**
 * Stellt ein Backup wieder her. Vorher wird der aktuelle Stand automatisch gesichert.
 * Ablauf: prüfen → Sicherheits-Backup → vorbereiten → DB schließen → Dateien tauschen → öffnen + migrieren.
 */
export async function restoreFrom(file: string): Promise<RestoreResult> {
  inspectBackup(file)
  const safety = await backupTo(undefined, 'pre-restore')

  const { dbFile, photosDir, root } = dataPaths()
  const stagingDb = join(root, 'restore-staging.db')
  const stagingPhotos = join(root, 'restore-staging-photos')
  stageRestore(file, stagingDb, stagingPhotos)

  shutdownDatabase()
  try {
    for (const suffix of ['', '-wal', '-shm']) rmSync(`${dbFile}${suffix}`, { force: true })
    renameSync(stagingDb, dbFile)
    const oldPhotos = `${photosDir}.old`
    rmSync(oldPhotos, { recursive: true, force: true })
    if (existsSync(photosDir)) renameSync(photosDir, oldPhotos)
    renameSync(stagingPhotos, photosDir)
    rmSync(oldPhotos, { recursive: true, force: true })
  } finally {
    // Datenbank in jedem Fall wieder öffnen (notfalls mit dem alten Stand aus dem Sicherheits-Backup)
    await initDatabase()
    startAutoBackup()
  }
  setMeta('last_backup_at', safety.createdAt)
  return { restoredFrom: file, safetyBackup: safety.path, schemaVersion: currentSchemaVersion(getDb()) }
}

/** Prüft regelmäßig, ob laut Einstellung ein automatisches Backup fällig ist. */
export function startAutoBackup(): void {
  if (autoTimer) clearInterval(autoTimer)
  const check = async () => {
    try {
      const interval = loadSettings().autoBackup
      if (interval === 'off' || !repos) return
      // Leere Datenbank nicht sichern
      const s = getRepos().stats.get()
      if (s.profiles + s.companies + s.documents === 0) return
      const last = getMeta('last_backup_at')
      const dueMs = interval === 'daily' ? 24 * 3600e3 : 7 * 24 * 3600e3
      if (!last || Date.now() - Date.parse(last) >= dueMs) {
        await backupTo(undefined, 'auto')
        console.info('[db] Automatisches Backup erstellt')
      }
    } catch (e) {
      console.warn('[db] Automatisches Backup fehlgeschlagen:', e instanceof Error ? e.name : 'unknown')
    }
  }
  setTimeout(check, 15_000)
  autoTimer = setInterval(check, 60 * 60 * 1000)
}
