/**
 * Datenmodelle des Archivs + Zod-Schemas zur Validierung aller Eingaben,
 * die über IPC in den Main-Process kommen. Geteilt zwischen Main und Renderer.
 */
import { z } from 'zod'

// ── Aufzählungen ────────────────────────────────────────────────────────────

export const applicationStatuses = ['draft', 'sent', 'interview', 'rejected', 'accepted'] as const
export type ApplicationStatus = (typeof applicationStatuses)[number]

export const documentTypes = ['cv', 'cover_letter', 'cover_page', 'free'] as const
export type DocumentType = (typeof documentTypes)[number]

export const eventKinds = ['interview', 'deadline', 'follow_up', 'other'] as const
export type EventKind = (typeof eventKinds)[number]

export const tagEntities = ['application', 'document', 'company', 'profile', 'photo'] as const
export type TagEntity = (typeof tagEntities)[number]

// ── Hilfs-Schemas ───────────────────────────────────────────────────────────

const id = z.number().int().positive()
const text = (max = 500) => z.string().trim().max(max)
const optText = (max = 500) => text(max).nullable().optional()
/** ISO-Datum/-Zeit ("2026-10-29" oder "2026-10-29T10:00") */
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/)
const optDate = isoDate.nullable().optional()

// ── Profile ─────────────────────────────────────────────────────────────────

export const profileInput = z.object({
  name: text(120).min(1),
  headline: optText(200),
  email: optText(200),
  phone: optText(60),
  address: optText(300),
  city: optText(120),
  birthDate: optDate
})
export type ProfileInput = z.infer<typeof profileInput>
export interface Profile extends Required<{ [K in keyof ProfileInput]: Exclude<ProfileInput[K], undefined> }> {
  id: number
  createdAt: string
  updatedAt: string
}
export interface ProfileRow extends Profile {
  applicationCount: number
  documentCount: number
  photoCount: number
  tags: string[]
}

// ── Firmen ──────────────────────────────────────────────────────────────────

export const companyInput = z.object({
  name: text(200).min(1),
  industry: optText(120),
  address: optText(300),
  city: optText(120),
  website: optText(300),
  contactName: optText(160),
  contactEmail: optText(200)
})
export type CompanyInput = z.infer<typeof companyInput>
export interface Company extends Required<{ [K in keyof CompanyInput]: Exclude<CompanyInput[K], undefined> }> {
  id: number
  createdAt: string
  updatedAt: string
}
export interface CompanyRow extends Company {
  applicationCount: number
  tags: string[]
}

// ── Bewerbungen ─────────────────────────────────────────────────────────────

export const applicationInput = z.object({
  profileId: id,
  companyId: id,
  role: text(200).min(1),
  location: optText(160),
  status: z.enum(applicationStatuses).default('draft'),
  jobPosting: optText(50_000),
  jobUrl: optText(1000),
  sentAt: optDate
})
export type ApplicationInput = z.input<typeof applicationInput>
export interface Application {
  id: number
  profileId: number
  companyId: number
  role: string
  location: string | null
  status: ApplicationStatus
  jobPosting: string | null
  jobUrl: string | null
  sentAt: string | null
  createdAt: string
  updatedAt: string
}
export interface ApplicationRow extends Application {
  companyName: string
  companyCity: string | null
  profileName: string
  documents: { id: number; type: DocumentType; title: string; version: number }[]
  photoCount: number
  tags: string[]
  /** Nächster anstehender Termin (z. B. Gespräch). */
  nextEvent: { kind: EventKind; startsAt: string } | null
}

export const applicationFilter = z.object({
  search: text(200).optional(),
  statuses: z.array(z.enum(applicationStatuses)).optional(),
  profileId: id.nullable().optional(),
  companyId: id.optional(),
  tags: z.array(text(60)).optional()
})
export type ApplicationFilter = z.infer<typeof applicationFilter>

// ── Dokumente & Versionen ──────────────────────────────────────────────────

/** Dokumentinhalt ist strukturiertes JSON (Format folgt in Phase 3). Max. 2 MB. */
const docContent = z.unknown().refine((v) => JSON.stringify(v ?? null).length < 2_000_000, 'too large')

export const documentInput = z.object({
  profileId: id,
  applicationId: id.nullable().optional(),
  type: z.enum(documentTypes),
  title: text(200).min(1),
  language: z.enum(['de', 'en']).default('de'),
  template: text(60).default('classic'),
  content: docContent.optional()
})
export type DocumentInput = z.input<typeof documentInput>
export const documentMetaPatch = documentInput.omit({ content: true, profileId: true }).partial()
export type DocumentMetaPatch = z.input<typeof documentMetaPatch>

export interface DocumentRecord {
  id: number
  profileId: number
  applicationId: number | null
  type: DocumentType
  title: string
  language: 'de' | 'en'
  template: string
  content: unknown
  currentVersion: number
  /** Zeitpunkt des letzten PDF/DOCX-Exports (Schema v2) */
  lastExportedAt: string | null
  createdAt: string
  updatedAt: string
}
export interface DocumentRow extends Omit<DocumentRecord, 'content'> {
  profileName: string
  companyName: string | null
  tags: string[]
}
export const documentFilter = z.object({
  search: text(200).optional(),
  type: z.enum(documentTypes).optional(),
  profileId: id.nullable().optional(),
  applicationId: id.optional(),
  tags: z.array(text(60)).optional(),
  limit: z.number().int().positive().max(500).optional()
})
export type DocumentFilter = z.infer<typeof documentFilter>

export interface DocumentVersion {
  id: number
  documentId: number
  version: number
  content: unknown
  note: string | null
  createdAt: string
}

// ── Fotos ───────────────────────────────────────────────────────────────────

export interface Photo {
  id: number
  profileId: number | null
  fileName: string
  width: number
  height: number
  format: 'png' | 'jpeg'
  label: string | null
  createdAt: string
  tags: string[]
}

// ── Notizen & Termine ──────────────────────────────────────────────────────

export const noteInput = z
  .object({
    applicationId: id.nullable().optional(),
    companyId: id.nullable().optional(),
    body: text(20_000).min(1)
  })
  .refine((n) => n.applicationId || n.companyId, 'note needs a parent')
export type NoteInput = z.input<typeof noteInput>
export interface Note {
  id: number
  applicationId: number | null
  companyId: number | null
  body: string
  createdAt: string
  updatedAt: string
}

export const eventInput = z.object({
  applicationId: id,
  kind: z.enum(eventKinds),
  title: optText(200),
  startsAt: isoDate,
  location: optText(300),
  notes: optText(5000)
})
export type EventInput = z.input<typeof eventInput>
export interface EventItem {
  id: number
  applicationId: number
  kind: EventKind
  title: string | null
  startsAt: string
  location: string | null
  notes: string | null
  createdAt: string
}

// ── Tags & Statistik ────────────────────────────────────────────────────────

export const tagName = z
  .string()
  .trim()
  .toLowerCase()
  .transform((s) => s.replace(/^#/, '').replace(/\s+/g, '-'))
  .pipe(z.string().min(1).max(60))

export interface TagCount {
  name: string
  count: number
}

export interface ArchiveStats {
  applications: number
  byStatus: Record<ApplicationStatus, number>
  documents: number
  photos: number
  companies: number
  profiles: number
}

export interface DbInfo {
  path: string
  sizeBytes: number
  schemaVersion: number
  lastBackupAt: string | null
}

export interface BackupResult {
  path: string
  sizeBytes: number
  createdAt: string
}

export interface RestoreResult {
  restoredFrom: string
  /** Sicherheits-Backup des vorherigen Zustands. */
  safetyBackup: string
  schemaVersion: number
}

// ── Hub / Dashboard (Quests, Hinweise, Statistik) ─────────────────────────

export const questSteps = ['cv', 'photo', 'letter', 'posting', 'export', 'sent'] as const
export type QuestStep = (typeof questSteps)[number]

export interface Quest {
  applicationId: number
  company: string
  role: string
  status: ApplicationStatus
  steps: { key: QuestStep; done: boolean }[]
  /** 0–100 */
  pct: number
  /** nächster offener Schritt */
  next: QuestStep | null
  cvId: number | null
  letterId: number | null
}

export type Notice =
  | { kind: 'followup'; applicationId: number; company: string; days: number }
  | { kind: 'event'; applicationId: number; company: string; eventKind: EventKind; startsAt: string }
  | { kind: 'backup'; days: number | null }

export const achievementKeys = ['firstSent', 'fiveSent', 'firstInterview', 'firstOffer', 'firstPhoto', 'firstBackup', 'weeklyGoal'] as const
export type AchievementKey = (typeof achievementKeys)[number]

export interface HubData {
  quests: Quest[]
  notices: Notice[]
  /** 8 Wochen, älteste zuerst; weekStart = Montag (YYYY-MM-DD) */
  weekly: { weekStart: string; sent: number }[]
  thisWeekSent: number
  stats: ArchiveStats
  achievements: { key: AchievementKey; done: boolean }[]
}
