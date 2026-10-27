/**
 * Hub-Auswertung: Quest-Fortschritt pro aktiver Bewerbung, Hinweise (Nachfassen, Termine,
 * Backup), Wochenverlauf gesendeter Bewerbungen und Erfolge. Alles lokal berechnet.
 */
import type { Db } from '../connection'
import { cvChecklist, isDocContent, type CvContent, type LetterContent } from '@shared/document'
import type { ApplicationStatus, EventKind, HubData, Notice, Quest, QuestStep } from '@shared/models'
import { statsRepo } from './misc'

const DAY = 24 * 3600 * 1000

/** Montag der Woche (lokale Zeit) als YYYY-MM-DD */
export function weekStart(d: Date): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const shift = (x.getDay() + 6) % 7 // Mo=0 … So=6
  x.setDate(x.getDate() - shift)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`
}

const parse = (json: string): unknown => {
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

interface DocRow {
  id: number
  application_id: number | null
  type: string
  content: string
  last_exported_at: string | null
  updated_at: string
}

export function dashboardRepo(db: Db) {
  const stats = statsRepo(db)

  /** Berechnung mit festem "Jetzt" (für Tests); über IPC ist nur get() erreichbar. */
  function compute(profileId: number | null | undefined, weeklyGoal: number, now: Date): HubData {
      const pid = profileId && Number.isInteger(profileId) ? profileId : null
      const goal = Number.isInteger(weeklyGoal) && weeklyGoal >= 0 && weeklyGoal <= 50 ? weeklyGoal : 3

      // ── Quests ──────────────────────────────────────────────────────────
      const apps = db
        .prepare(
          `SELECT a.id, a.role, a.status, a.job_posting, a.sent_at, a.updated_at, c.name AS company
           FROM applications a JOIN companies c ON c.id = a.company_id
           WHERE (@pid IS NULL OR a.profile_id = @pid) AND a.status IN ('draft','sent','interview')
           ORDER BY a.updated_at DESC`
        )
        .all({ pid }) as { id: number; role: string; status: ApplicationStatus; job_posting: string | null; sent_at: string | null; updated_at: string; company: string }[]

      const docs = db
        .prepare(
          `SELECT id, application_id, type, content, last_exported_at, updated_at FROM documents
           WHERE (@pid IS NULL OR profile_id = @pid) AND type IN ('cv','cover_letter')
           ORDER BY updated_at DESC`
        )
        .all({ pid }) as DocRow[]
      // Allgemeiner Lebenslauf (ohne Bewerbung) als Rückfall für Bewerbungen ohne eigenen CV
      const generalCv = docs.find((d) => d.type === 'cv' && d.application_id === null) ?? docs.find((d) => d.type === 'cv')

      const quests: Quest[] = apps.map((a) => {
        const own = docs.filter((d) => d.application_id === a.id)
        const cvDoc = own.find((d) => d.type === 'cv') ?? generalCv ?? null
        const letterDoc = own.find((d) => d.type === 'cover_letter') ?? null
        const cv = cvDoc ? parse(cvDoc.content) : null
        const letter = letterDoc ? parse(letterDoc.content) : null
        const cvChecks = isDocContent(cv) && cv.kind === 'cv' ? cvChecklist(cv as CvContent) : []
        const l = isDocContent(letter) && letter.kind === 'letter' ? (letter as LetterContent) : null

        const done: Record<QuestStep, boolean> = {
          cv: cvChecks.length > 0 && cvChecks.filter((c) => c.key !== 'photo').every((c) => c.done),
          photo: cvChecks.find((c) => c.key === 'photo')?.done ?? false,
          letter: !!l && !!l.recipient.company.trim() && !!l.subject.trim() && !l.subject.includes('…') && l.body.trim().length > 200,
          posting: !!a.job_posting?.trim(),
          export: own.some((d) => !!d.last_exported_at),
          sent: a.status !== 'draft'
        }
        const steps = (Object.keys(done) as QuestStep[]).map((key) => ({ key, done: done[key] }))
        const count = steps.filter((s) => s.done).length
        return {
          applicationId: a.id,
          company: a.company,
          role: a.role,
          status: a.status,
          steps,
          pct: Math.round((count / steps.length) * 100),
          next: steps.find((s) => !s.done)?.key ?? null,
          cvId: cvDoc?.id ?? null,
          letterId: letterDoc?.id ?? null
        }
      })

      // ── Hinweise ────────────────────────────────────────────────────────
      const notices: Notice[] = []
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

      // Termine der nächsten 7 Tage
      const events = db
        .prepare(
          `SELECT e.application_id, e.kind, e.starts_at, c.name AS company FROM events e
           JOIN applications a ON a.id = e.application_id JOIN companies c ON c.id = a.company_id
           WHERE (@pid IS NULL OR a.profile_id = @pid) AND e.starts_at >= @from AND e.starts_at < @to
           ORDER BY e.starts_at LIMIT 5`
        )
        .all({ pid, from: iso(today), to: iso(new Date(today.getTime() + 8 * DAY)) }) as { application_id: number; kind: EventKind; starts_at: string; company: string }[]
      for (const e of events) notices.push({ kind: 'event', applicationId: e.application_id, company: e.company, eventKind: e.kind, startsAt: e.starts_at })

      // Nachfassen: seit ≥ 14 Tagen gesendet, keine Termine, Status unverändert
      for (const a of apps) {
        if (a.status !== 'sent' || !a.sent_at) continue
        const days = Math.floor((today.getTime() - new Date(`${a.sent_at.slice(0, 10)}T00:00`).getTime()) / DAY)
        const hasEvent = db.prepare('SELECT 1 FROM events WHERE application_id = ?').get(a.id)
        if (days >= 14 && !hasEvent) notices.push({ kind: 'followup', applicationId: a.id, company: a.company, days })
      }

      // Backup-Erinnerung (nur wenn es Daten gibt)
      const st = stats.get(pid)
      const lastBackup = (db.prepare("SELECT value FROM app_meta WHERE key = 'last_backup_at'").get() as { value: string } | undefined)?.value ?? null
      const backupDays = lastBackup ? Math.floor((now.getTime() - Date.parse(lastBackup)) / DAY) : null
      if (st.profiles > 0 && (backupDays === null || backupDays >= 7)) notices.push({ kind: 'backup', days: backupDays })

      // ── Wochenverlauf (gesendete Bewerbungen, 8 Wochen) ────────────────
      const thisMonday = weekStart(now)
      const weeks: string[] = []
      for (let i = 7; i >= 0; i--) weeks.push(weekStart(new Date(new Date(`${thisMonday}T12:00`).getTime() - i * 7 * DAY)))
      const sentDates = db
        .prepare(`SELECT sent_at FROM applications WHERE sent_at IS NOT NULL AND (@pid IS NULL OR profile_id = @pid) AND sent_at >= @from`)
        .all({ pid, from: weeks[0] }) as { sent_at: string }[]
      const counts = new Map(weeks.map((w) => [w, 0]))
      for (const r of sentDates) {
        const w = weekStart(new Date(`${r.sent_at.slice(0, 10)}T12:00`))
        if (counts.has(w)) counts.set(w, counts.get(w)! + 1)
      }
      const weekly = weeks.map((w) => ({ weekStart: w, sent: counts.get(w) ?? 0 }))
      const thisWeekSent = counts.get(thisMonday) ?? 0

      // ── Erfolge ─────────────────────────────────────────────────────────
      const sentTotal = st.applications - st.byStatus.draft
      const interviews = (db.prepare(`SELECT COUNT(*) AS c FROM events e JOIN applications a ON a.id = e.application_id WHERE e.kind = 'interview' AND (@pid IS NULL OR a.profile_id = @pid)`).get({ pid }) as { c: number }).c
      const achievements: HubData['achievements'] = [
        { key: 'firstSent', done: sentTotal >= 1 },
        { key: 'fiveSent', done: sentTotal >= 5 },
        { key: 'firstInterview', done: st.byStatus.interview + st.byStatus.accepted > 0 || interviews > 0 },
        { key: 'firstOffer', done: st.byStatus.accepted > 0 },
        { key: 'firstPhoto', done: st.photos > 0 },
        { key: 'firstBackup', done: !!lastBackup },
        { key: 'weeklyGoal', done: goal > 0 && thisWeekSent >= goal }
      ]

      return { quests, notices, weekly, thisWeekSent, stats: st, achievements }
  }

  return {
    compute,
    get(profileId?: number | null, weeklyGoal = 3): HubData {
      return compute(profileId, weeklyGoal, new Date())
    }
  }
}
