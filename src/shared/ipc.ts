/**
 * IPC-Vertrag zwischen Renderer und Main-Process.
 *
 * Der Renderer hat keinen Node-Zugriff (contextIsolation an, nodeIntegration aus).
 * Er spricht ausschließlich über die hier definierten Kanäle mit dem Main-Process;
 * das Preload-Skript stellt sie als `window.docforge` bereit.
 */
import type { AppSettings } from './settings'
import type {
  Application,
  ApplicationFilter,
  ApplicationInput,
  ApplicationRow,
  ArchiveStats,
  BackupResult,
  Company,
  CompanyInput,
  CompanyRow,
  DbInfo,
  DocumentFilter,
  DocumentInput,
  DocumentMetaPatch,
  DocumentRecord,
  DocumentRow,
  DocumentVersion,
  EventInput,
  EventItem,
  Note,
  NoteInput,
  Photo,
  Profile,
  ProfileInput,
  ProfileRow,
  RestoreResult,
  TagCount,
  TagEntity
} from './models'

/** Alle erlaubten Kanalnamen an einer Stelle – nichts anderes wird durchgereicht. */
export const IpcChannels = {
  appInfo: 'app:info',
  openExternalDataFolder: 'app:open-data-folder',
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  /** Main → Renderer: Menüaktionen (z. B. "Über DocForge"). */
  menuAction: 'menu:action',
  /** Ein Kanal für alle Repository-Aufrufe; Namespace/Methode werden gegen `dbMethodNames` geprüft. */
  dbCall: 'db:call',
  archiveInfo: 'archive:info',
  archiveBackupNow: 'archive:backup-now',
  archiveExport: 'archive:export',
  archiveRestore: 'archive:restore',
  archiveChooseBackupFolder: 'archive:choose-backup-folder',
  archiveOpenBackupFolder: 'archive:open-backup-folder',
  archiveSeedDemo: 'archive:seed-demo',
  photoImport: 'photo:import',
  photoSaveCaptured: 'photo:save-captured',
  cameraAccess: 'camera:access',
  exportPdf: 'export:pdf',
  exportDocx: 'export:docx',
  /** Print-Fenster meldet: Dokument ist gerendert, PDF kann erzeugt werden. */
  printReady: 'print:ready',
  printGetDoc: 'print:get-doc',
  updateCheck: 'update:check',
  updateDownload: 'update:download',
  updateInstall: 'update:install',
  /** Main → Renderer: Update-Status */
  updateStatus: 'update:status',
  /** Main → Renderer: Datenbank wurde extern verändert (z. B. Wiederherstellung). */
  dbChanged: 'db:changed'
} as const

/**
 * Vertrag der Datenbank-Repositories (synchron im Main-Process).
 * Der Main-Process prüft per TypeScript, dass seine Repositories genau diesen Vertrag erfüllen.
 */
export interface DbContract {
  profiles: {
    list(search?: string): ProfileRow[]
    get(id: number): Profile
    create(input: ProfileInput): Profile
    update(id: number, patch: Partial<ProfileInput>): Profile
    remove(id: number): void
  }
  companies: {
    list(search?: string): CompanyRow[]
    get(id: number): Company
    create(input: CompanyInput): Company
    update(id: number, patch: Partial<CompanyInput>): Company
    remove(id: number): void
  }
  applications: {
    list(filter?: ApplicationFilter): ApplicationRow[]
    get(id: number): Application
    getRow(id: number): ApplicationRow
    create(input: ApplicationInput): Application
    update(id: number, patch: Partial<ApplicationInput>): Application
    remove(id: number): void
    attachPhoto(applicationId: number, photoId: number): void
  }
  documents: {
    list(filter?: DocumentFilter): DocumentRow[]
    get(id: number): DocumentRecord
    create(input: DocumentInput): DocumentRecord
    updateMeta(id: number, patch: DocumentMetaPatch): DocumentRecord
    saveContent(id: number, content: unknown, note?: string | null): DocumentRecord
    autosave(id: number, content: unknown): DocumentRecord
    versions(id: number): DocumentVersion[]
    restoreVersion(id: number, version: number): DocumentRecord
    duplicate(id: number): DocumentRecord
    remove(id: number): void
  }
  notes: {
    list(parent: { applicationId?: number; companyId?: number }): Note[]
    create(input: NoteInput): Note
    update(id: number, body: string): Note
    remove(id: number): void
  }
  events: {
    list(applicationId: number): EventItem[]
    upcoming(limit?: number): (EventItem & { companyName: string; role: string })[]
    create(input: EventInput): EventItem
    update(id: number, patch: Partial<EventInput>): EventItem
    remove(id: number): void
  }
  photos: {
    list(profileId?: number | null): Photo[]
    remove(id: number): void
  }
  tags: {
    list(entity?: TagEntity): TagCount[]
    set(entity: TagEntity, id: number, names: string[]): string[]
  }
  stats: {
    get(profileId?: number | null): ArchiveStats
  }
}

/** Laufzeit-Allowlist: nur diese Methoden dürfen über `db:call` aufgerufen werden. */
export const dbMethodNames: { [NS in keyof DbContract]: (keyof DbContract[NS])[] } = {
  profiles: ['list', 'get', 'create', 'update', 'remove'],
  companies: ['list', 'get', 'create', 'update', 'remove'],
  applications: ['list', 'get', 'getRow', 'create', 'update', 'remove', 'attachPhoto'],
  documents: ['list', 'get', 'create', 'updateMeta', 'saveContent', 'autosave', 'versions', 'restoreVersion', 'duplicate', 'remove'],
  notes: ['list', 'create', 'update', 'remove'],
  events: ['list', 'upcoming', 'create', 'update', 'remove'],
  photos: ['list', 'remove'],
  tags: ['list', 'set'],
  stats: ['get']
}

/** Macht aus synchronen Methoden Promise-Methoden (so sieht sie der Renderer). */
type Async<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R ? (...args: A) => Promise<Awaited<R>> : never
}
export type DbApi = { [NS in keyof DbContract]: Async<DbContract[NS]> }

export interface AppInfo {
  name: string
  /** Aus package.json (app.getVersion()). */
  version: string
  /** Nutzerdatenordner (app.getPath('userData')). */
  dataPath: string
  platform: string
  isDev: boolean
}

export type MenuAction = 'about' | 'new:cv' | 'new:letter' | 'navigate:hub' | 'navigate:editor' | 'navigate:studio' | 'navigate:archive' | 'navigate:settings'

/** Die API, die der Renderer unter `window.docforge` sieht. */
export interface DocForgeApi {
  app: {
    getInfo(): Promise<AppInfo>
    openDataFolder(): Promise<void>
  }
  settings: {
    get(): Promise<AppSettings>
    set(patch: Partial<AppSettings>): Promise<AppSettings>
  }
  db: DbApi
  archive: {
    info(): Promise<DbInfo>
    /** Backup in den eingestellten Backup-Ordner. */
    backupNow(): Promise<BackupResult>
    /** Speichern-Dialog → .dfdb exportieren. `null` = abgebrochen. */
    exportBackup(): Promise<BackupResult | null>
    /** Öffnen-Dialog → .dfdb wiederherstellen. `null` = abgebrochen. */
    restoreBackup(): Promise<RestoreResult | null>
    chooseBackupFolder(): Promise<string | null>
    openBackupFolder(): Promise<void>
    /** Legt fiktive Beispieldaten an (zum Ausprobieren). */
    seedDemo(): Promise<void>
  }
  photos: {
    /** Öffnen-Dialog → Bild in den Fotoordner übernehmen. `null` = abgebrochen. */
    importFromFile(profileId: number | null): Promise<Photo | null>
    /** Aufnahme aus dem Kamera-Studio in voller Qualität speichern. */
    saveCaptured(input: { data: Uint8Array; format: 'png' | 'jpeg'; width: number; height: number; profileId: number | null; label: string | null }): Promise<Photo>
  }
  camera: {
    /** macOS: Systemfreigabe für die Kamera anfragen. Windows/Linux: immer true. */
    requestAccess(): Promise<boolean>
  }
  exporter: {
    /** Speichern-Dialog → PDF aus der A4-Vorschau. Gibt den Pfad zurück (`null` = abgebrochen). */
    pdf(documentId: number): Promise<string | null>
    docx(documentId: number): Promise<string | null>
  }
  print: {
    /** Nur im Print-Fenster: Dokument laden und Fertig melden. */
    getDoc(): Promise<{ doc: DocumentRecord; lang: 'de' | 'en' } | null>
    ready(): void
  }
  updates: {
    check(): Promise<void>
    download(): Promise<void>
    install(): Promise<void>
    onStatus(cb: (s: UpdateStatus) => void): () => void
  }
  /** Abonniert Menüaktionen; gibt eine Abmelde-Funktion zurück. */
  onMenuAction(cb: (action: MenuAction) => void): () => void
  /** Benachrichtigung, wenn die Datenbank ausgetauscht wurde (z. B. nach Wiederherstellung). */
  onDbChanged(cb: () => void): () => void
}

export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'none'; version: string }
  | { state: 'available'; version: string; notes: string; date: string | null }
  | { state: 'downloading'; percent: number; version: string }
  | { state: 'downloaded'; version: string }
  | { state: 'offline' }
  | { state: 'dev' }
  | { state: 'error'; message: string }

/** Liest den Fehlercode aus einer IPC-Fehlermeldung ("… [IN_USE] …"). */
export function ipcErrorCode(e: unknown): string {
  const m = /\[([A-Z_]+)\]/.exec(e instanceof Error ? e.message : String(e))
  return m ? m[1] : 'INTERNAL'
}
