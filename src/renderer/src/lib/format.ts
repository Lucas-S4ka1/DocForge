/** Formatierung von Datum, Größe usw. passend zur UI-Sprache. */
import type { Language } from '@shared/settings'

const locale = (lang: Language) => (lang === 'de' ? 'de-DE' : 'en-GB')

/** "2026-10-29" / ISO → "29.10.2026" */
export function formatDate(iso: string | null | undefined, lang: Language): string {
  if (!iso) return '—'
  const d = new Date(iso.length === 10 ? `${iso}T00:00` : iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(locale(lang), { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** ISO mit Uhrzeit → "29.10.2026 · 10:00" */
export function formatDateTime(iso: string | null | undefined, lang: Language): string {
  if (!iso) return '—'
  if (iso.length === 10) return formatDate(iso, lang)
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${formatDate(iso, lang)} · ${d.toLocaleTimeString(locale(lang), { hour: '2-digit', minute: '2-digit' })}`
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`
}

/** "#0014" wie im Design */
export const recordNo = (id: number) => `#${String(id).padStart(4, '0')}`
