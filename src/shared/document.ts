/**
 * Inhaltsmodell der Dokumente (wird als JSON in `documents.content` gespeichert).
 * Geteilt zwischen Renderer (Editor, Vorschau) und Main-Process (DOCX-Export).
 */
import type { DocumentType, Profile } from './models'

// ── Gestaltung ──────────────────────────────────────────────────────────────

export type MarginSize = 'narrow' | 'normal' | 'wide'
export type PhotoPosition = 'left' | 'right' | 'none'
export type DocFont = 'barlow' | 'inter' | 'serif'

export interface DocStyle {
  template: string
  font: DocFont
  /** Akzentfarbe als Hex, z. B. "#2C5A85" */
  accent: string
  margins: MarginSize
  photoPosition: PhotoPosition
  /** Foto-Dateiname im Fotoordner (null = kein Foto) */
  photo: string | null
}

/** Seitenränder in Millimetern. */
export const marginMm: Record<MarginSize, { top: number; right: number; bottom: number; left: number }> = {
  narrow: { top: 14, right: 14, bottom: 14, left: 16 },
  normal: { top: 20, right: 20, bottom: 18, left: 22 },
  wide: { top: 25, right: 25, bottom: 22, left: 27 }
}

export const accentPresets = ['#2C5A85', '#1F3A5F', '#1F6F78', '#3A3A3C', '#7A2E3A', '#2F6B4F'] as const

export const docFonts: Record<DocFont, { label: string; heading: string; body: string; docx: string }> = {
  barlow: { label: 'Barlow Condensed / Barlow', heading: "'Barlow Condensed'", body: "'Barlow'", docx: 'Arial' },
  inter: { label: 'Inter', heading: "'Inter'", body: "'Inter'", docx: 'Calibri' },
  serif: { label: 'Source Serif', heading: "'Source Serif 4'", body: "'Source Serif 4'", docx: 'Georgia' }
}

/** Verfügbare Vorlagen je Dokumenttyp (Reihenfolge = Anzeige im Editor). */
export const templatesByType: Record<DocumentType, string[]> = {
  cv: ['classic', 'twocolumn', 'modern', 'minimal'],
  cover_letter: ['din-b', 'din-a', 'modern-letter'],
  cover_page: ['cover-classic', 'cover-modern'],
  free: ['plain']
}

// ── Lebenslauf ──────────────────────────────────────────────────────────────

export type SectionKind = 'profile' | 'experience' | 'education' | 'skills' | 'languages' | 'certificates' | 'interests' | 'custom'

export interface CvEntry {
  id: string
  /** z. B. Position / Abschluss */
  title: string
  /** z. B. Firma / Hochschule */
  org: string
  location: string
  start: string
  end: string
  description: string
}

export interface CvItem {
  id: string
  name: string
  /** optionaler Zusatz, z. B. "C1" oder "Muttersprache" */
  level: string
}

export interface CvSection {
  id: string
  kind: SectionKind
  title: string
  visible: boolean
  /** profile / custom */
  text: string
  /** experience / education / certificates / custom */
  entries: CvEntry[]
  /** skills / languages / interests */
  items: CvItem[]
}

export interface PersonalData {
  name: string
  headline: string
  email: string
  phone: string
  address: string
  city: string
  birthDate: string
  website: string
}

export interface CvContent {
  kind: 'cv'
  personal: PersonalData
  sections: CvSection[]
  /** Ort, Datum und Unterschriftszeile am Ende (in Deutschland üblich) */
  signature: { show: boolean; place: string; date: string }
  style: DocStyle
}

// ── Anschreiben (DIN 5008) ──────────────────────────────────────────────────

export interface LetterContent {
  kind: 'letter'
  sender: { name: string; street: string; city: string; phone: string; email: string }
  recipient: { company: string; contact: string; street: string; city: string }
  place: string
  date: string
  subject: string
  /** optionale Bezugszeile, z. B. "Ihre Anzeige vom … · Kennziffer …" */
  reference: string
  salutation: string
  /** Absätze durch Leerzeile getrennt */
  body: string
  closing: string
  signatureName: string
  attachments: string
  style: DocStyle
}

// ── Deckblatt & freies Dokument ─────────────────────────────────────────────

export interface CoverContent {
  kind: 'cover'
  title: string
  subtitle: string
  company: string
  name: string
  contact: string
  attachments: string
  style: DocStyle
}

export interface FreeContent {
  kind: 'free'
  title: string
  /** Absätze durch Leerzeile; Zeilen mit "# " sind Zwischenüberschriften, "- " Aufzählungen */
  body: string
  style: DocStyle
}

export type DocContent = CvContent | LetterContent | CoverContent | FreeContent

// ── Fabriken ────────────────────────────────────────────────────────────────

export const uid = () => Math.random().toString(36).slice(2, 10)

export const sectionTitles: Record<'de' | 'en', Record<SectionKind, string>> = {
  de: {
    profile: 'Profil',
    experience: 'Berufserfahrung',
    education: 'Ausbildung',
    skills: 'Kenntnisse',
    languages: 'Sprachen',
    certificates: 'Weiterbildungen',
    interests: 'Interessen',
    custom: 'Eigener Abschnitt'
  },
  en: {
    profile: 'Profile',
    experience: 'Experience',
    education: 'Education',
    skills: 'Skills',
    languages: 'Languages',
    certificates: 'Certificates',
    interests: 'Interests',
    custom: 'Custom section'
  }
}

export function emptyEntry(): CvEntry {
  return { id: uid(), title: '', org: '', location: '', start: '', end: '', description: '' }
}
export function emptyItem(name = '', level = ''): CvItem {
  return { id: uid(), name, level }
}
export function newSection(kind: SectionKind, lang: 'de' | 'en' = 'de'): CvSection {
  return { id: uid(), kind, title: sectionTitles[lang][kind], visible: true, text: '', entries: [], items: [] }
}

function baseStyle(type: DocumentType): DocStyle {
  return {
    template: templatesByType[type][0],
    font: 'barlow',
    accent: accentPresets[0],
    margins: 'normal',
    photoPosition: type === 'cv' ? 'right' : 'none',
    photo: null
  }
}

const today = (lang: 'de' | 'en') =>
  new Date().toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })

/** Erzeugt einen sinnvoll vorbelegten Inhalt für einen neuen Dokumenttyp. */
export function createContent(type: DocumentType, profile: Partial<Profile> | null, lang: 'de' | 'en' = 'de', company?: string): DocContent {
  const p = profile ?? {}
  const style = baseStyle(type)
  const city = p.city ?? ''
  switch (type) {
    case 'cv':
      return {
        kind: 'cv',
        personal: {
          name: p.name ?? '',
          headline: p.headline ?? '',
          email: p.email ?? '',
          phone: p.phone ?? '',
          address: p.address ?? '',
          city,
          birthDate: '',
          website: ''
        },
        sections: [
          { ...newSection('profile', lang), text: '' },
          { ...newSection('experience', lang), entries: [emptyEntry()] },
          { ...newSection('education', lang), entries: [emptyEntry()] },
          { ...newSection('skills', lang), items: [emptyItem()] },
          { ...newSection('languages', lang), items: [emptyItem(lang === 'de' ? 'Deutsch' : 'German', lang === 'de' ? 'Muttersprache' : 'native')] }
        ],
        signature: { show: true, place: city, date: today(lang) },
        style
      }
    case 'cover_letter':
      return {
        kind: 'letter',
        sender: { name: p.name ?? '', street: p.address ?? '', city, phone: p.phone ?? '', email: p.email ?? '' },
        recipient: { company: company ?? '', contact: '', street: '', city: '' },
        place: city,
        date: today(lang),
        subject: lang === 'de' ? 'Bewerbung als …' : 'Application for the position of …',
        reference: '',
        salutation: lang === 'de' ? 'Sehr geehrte Damen und Herren,' : 'Dear Sir or Madam,',
        body:
          lang === 'de'
            ? 'mit großem Interesse habe ich Ihre Stellenausschreibung gelesen …\n\nIn meiner bisherigen Tätigkeit …\n\nÜber die Einladung zu einem persönlichen Gespräch freue ich mich sehr.'
            : 'I read your job posting with great interest …\n\nIn my current role …\n\nI look forward to hearing from you.',
        closing: lang === 'de' ? 'Mit freundlichen Grüßen' : 'Kind regards',
        signatureName: p.name ?? '',
        attachments: lang === 'de' ? 'Lebenslauf, Zeugnisse' : 'CV, references',
        style
      }
    case 'cover_page':
      return {
        kind: 'cover',
        title: lang === 'de' ? 'Bewerbung' : 'Application',
        subtitle: lang === 'de' ? `als ${p.headline ?? '…'}` : `for the position of ${p.headline ?? '…'}`,
        company: company ?? '',
        name: p.name ?? '',
        contact: [p.address, city, p.phone, p.email].filter(Boolean).join('\n'),
        attachments: lang === 'de' ? 'Anschreiben\nLebenslauf\nZeugnisse' : 'Cover letter\nCV\nReferences',
        style: { ...style, photoPosition: 'right' }
      }
    default:
      return { kind: 'free', title: '', body: '', style }
  }
}

/** Prüft grob, ob ein JSON-Wert ein gültiger Inhalt ist (ältere/leere Dokumente → neu anlegen). */
export function isDocContent(v: unknown): v is DocContent {
  return !!v && typeof v === 'object' && ['cv', 'letter', 'cover', 'free'].includes((v as { kind?: string }).kind ?? '') && !!(v as { style?: unknown }).style
}

export const contentKindFor: Record<DocumentType, DocContent['kind']> = {
  cv: 'cv',
  cover_letter: 'letter',
  cover_page: 'cover',
  free: 'free'
}

/** Vollständigkeits-Check für den Lebenslauf ("Quest"). */
export function cvChecklist(c: CvContent): { key: string; done: boolean }[] {
  const has = (k: SectionKind, f: (s: CvSection) => boolean) => c.sections.some((s) => s.kind === k && s.visible && f(s))
  return [
    { key: 'personal', done: !!(c.personal.name && (c.personal.email || c.personal.phone)) },
    { key: 'experience', done: has('experience', (s) => s.entries.some((e) => e.title || e.org)) },
    { key: 'education', done: has('education', (s) => s.entries.some((e) => e.title || e.org)) },
    { key: 'skills', done: has('skills', (s) => s.items.some((i) => i.name)) },
    { key: 'photo', done: !!c.style.photo && c.style.photoPosition !== 'none' }
  ]
}
