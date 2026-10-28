/**
 * Import vorhandener Dokumente (Word/PDF/Text): erkennt im reinen Text Kontaktdaten,
 * Abschnitte und Stationen eines Lebenslaufs bzw. die Teile eines Anschreibens.
 * Reine Heuristik – läuft komplett offline. Das Ergebnis wird im Vorschau-Dialog
 * gezeigt und danach im Editor geprüft und ergänzt.
 */
import {
  createContent,
  emptyEntry,
  emptyItem,
  newSection,
  sectionTitles,
  type CvContent,
  type CvEntry,
  type CvItem,
  type CvSection,
  type LetterContent,
  type PersonalData,
  type SectionKind
} from './document'
import type { Profile } from './models'

type Lang = 'de' | 'en'

// ── Zeilen aufbereiten ──────────────────────────────────────────────────────

const junkTitle = /^(tabellarischer\s+)?(lebenslauf|curriculum\s+vitae|cv|resume|résumé)$/i
const junkPage = /^(seite|page)\s+\d+(\s+(von|of)\s+\d+)?$|^\d+\s*\/\s*\d+$/i
const bullet = /^[•▪■●◦‣►✓*·\-–]\s*/

/** "P R O F I L" → "PROFIL" (gesperrt gesetzte Überschriften aus PDFs). */
function despace(line: string): string {
  const tokens = line.split(' ')
  if (tokens.length < 4) return line
  const single = tokens.filter((t) => t.length === 1).length
  return single / tokens.length > 0.75 ? tokens.join('') : line
}

/** Text → getrimmte Zeilen; Leerzeilen bleiben als '' erhalten (Absatzgrenzen). */
export function toLines(text: string): string[] {
  const out: string[] = []
  for (const raw of text.replace(/\r\n?/g, '\n').replace(/[   ]/g, ' ').split('\n')) {
    const line = despace(raw.replace(/\t+/g, '  ').replace(/ {3,}/g, '  ').trim())
    if (junkTitle.test(line) && out.filter(Boolean).length < 3) continue
    if (junkPage.test(line)) continue
    if (!line && (out.length === 0 || out[out.length - 1] === '')) continue
    out.push(line)
  }
  while (out.length && out[out.length - 1] === '') out.pop()
  return out
}

const tidy = (s: string) => s.replace(/\s{2,}/g, ' ').replace(/^[\s,;:·|–-]+|[\s,;:·|–-]+$/g, '').trim()

// ── Datumsangaben ───────────────────────────────────────────────────────────

const MONTH =
  '(?:jan(?:uar|uary)?|feb(?:ruar|ruary)?|m(?:ä|ae)rz|mar(?:ch)?|apr(?:il)?|mai|may|jun(?:i|e)?|jul(?:i|y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|okt(?:ober)?|oct(?:ober)?|nov(?:ember)?|dez(?:ember)?|dec(?:ember)?)\\.?'
const DATE = `(?:\\d{1,2}\\.\\s?\\d{1,2}\\.\\s?\\d{2,4}|\\d{1,2}\\s?[./]\\s?\\d{4}|${MONTH}\\s?\\d{4}|(?:19|20)\\d{2})`
const OPEN = '(?:bis\\s+)?(?:heute|jetzt|aktuell|dato|present|now|today|current|laufend|ongoing)'
const SEP = '\\s*(?:-|–|—|bis|to|until)\\s*'
const rangeStart = new RegExp(`^(?:(?:seit|since|ab)\\s+(${DATE})|(${DATE})(?:${SEP}(${DATE}|${OPEN})?)?)(?![\\d.])`, 'i')
const rangeEnd = new RegExp(`[\\s(,|·]+(?:(?:seit|since|ab)\\s+(${DATE})|(${DATE})${SEP}(${DATE}|${OPEN}))\\)?$`, 'i')
const onlyDate = new RegExp(`^${DATE}(?:${SEP})?$`, 'i')
const openWord = new RegExp(`^${OPEN}$`, 'i')

interface DateMatch {
  start: string
  end: string
  rest: string
}

function normEnd(end: string, lang: Lang): string {
  return openWord.test(end) ? (lang === 'de' ? 'heute' : 'today') : end
}

/** Zeitraum am Zeilenanfang (oder am Zeilenende) erkennen. */
function matchDate(line: string, lang: Lang): DateMatch | null {
  const s = rangeStart.exec(line)
  if (s) {
    const rest = line.slice(s[0].length)
    // "2019 Projektleiter" ist ok, "2019er Modell" nicht
    if (rest && !/^[\s:|·,–-]/.test(rest)) return null
    if (s[1]) return { start: s[1], end: lang === 'de' ? 'heute' : 'today', rest: tidy(rest) }
    return { start: s[2], end: s[3] ? normEnd(s[3], lang) : '', rest: tidy(rest) }
  }
  const e = rangeEnd.exec(line)
  if (e && e.index > 2) {
    if (e[1]) return { start: e[1], end: lang === 'de' ? 'heute' : 'today', rest: tidy(line.slice(0, e.index)) }
    return { start: e[2], end: normEnd(e[3], lang), rest: tidy(line.slice(0, e.index)) }
  }
  return null
}

/** "2019" + "2021 Junior …" (umbrochener Zeitraum aus PDFs) → "2019 – 2021 Junior …" */
function joinWrappedDates(lines: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    const skip = lines[i + 1] === '' ? 1 : 0 // PDF: Leerzeile zwischen den beiden Teilen
    const next = lines[i + 1 + skip]
    if (onlyDate.test(l) && next && (rangeStart.test(next) || openWord.test(next.split(/\s{2,}| (?=[A-ZÄÖÜ])/)[0]))) {
      out.push(`${l.replace(/[\s–—-]+$/, '')} – ${next}`)
      i += 1 + skip
    } else out.push(l)
  }
  return out
}

// ── Überschriften ───────────────────────────────────────────────────────────

type HeadingKind = SectionKind | 'personal'

const headingRules: [RegExp, HeadingKind][] = [
  [/^(persönliche (daten|angaben)|persönliches|kontakt(daten)?|angaben zur person|zur person|personal (details|data|information)|contact( details| information)?)$/, 'personal'],
  [/^(profil|kurzprofil|berufsprofil|über mich|zusammenfassung|persönliches profil|profile|summary|about me|professional summary|personal statement)$/, 'profile'],
  [
    /^(berufserfahrung(en)?|berufliche erfahrung(en)?|beruflicher werdegang|berufspraxis|berufliche stationen|praxiserfahrung|praktische erfahrung(en)?|praktika|praktikum|beschäftigungsverlauf|tätigkeiten|werdegang|work experience|professional experience|experience|employment( history)?|career)$/,
    'experience'
  ],
  [
    /^(aus- und weiterbildung|ausbildung|schulbildung|schulische ausbildung|schul- und berufsausbildung|berufsausbildung|bildungsweg|bildung|studium|akademischer werdegang|hochschulbildung|schule|education|academic background)$/,
    'education'
  ],
  [/^(weiterbildung(en)?|fortbildung(en)?|zertifikate|zertifizierungen|zusatzqualifikationen|qualifikationen|lehrgänge|kurse|seminare|certificates|certifications|courses|training)$/, 'certificates'],
  [/^(sprachen|sprachkenntnisse|fremdsprachen|languages|language skills)$/, 'languages'],
  [/^(kenntnisse|fähigkeiten|kompetenzen|fachkompetenzen|edv|software|fachkenntnisse|besondere kenntnisse|sonstige kenntnisse|skills|technical skills|key skills|competencies|it skills)$/, 'skills'],
  [/^(interessen|hobbys|hobbies|freizeit|freizeitaktivitäten|interests|hobbies (and|&) interests)$/, 'interests']
]

const legalForm = /\b(gmbh|ag|kg|ohg|se|ug|e\.?\s?v\.?|gbr|mbh|inc|ltd|llc|co\.?)\b/i

function headingOf(line: string): { kind: HeadingKind; title: string; guessed?: boolean } | null {
  const title = line.replace(bullet, '').replace(/[:：]\s*$/, '').trim()
  if (!title || title.length > 45 || /\d{3,}/.test(title)) return null
  const key = title.toLowerCase().replace(/\s+/g, ' ')
  for (const [re, kind] of headingRules) if (re.test(key)) return { kind, title }
  if (/kenntnisse$|skills$/.test(key) && key.split(' ').length <= 4) return { kind: /sprach/.test(key) && !/edv|it|computer/.test(key) ? 'languages' : 'skills', title }
  if (/^(ehrenamt|ehrenamtliches engagement|engagement|projekte|publikationen|auszeichnungen|volunteering|projects|awards|publications)$/.test(key)) return { kind: 'custom', title }
  // Unbekannte Überschrift in GROSSBUCHSTABEN (z. B. "AUSLANDSAUFENTHALTE")
  const words = title.split(/\s+/)
  if (title.length >= 4 && words.length <= 3 && /^[A-ZÄÖÜß&\s-]+$/.test(title) && !legalForm.test(title)) return { kind: 'custom', title, guessed: true }
  return null
}

const niceTitle = (t: string) => (t === t.toUpperCase() ? t.charAt(0) + t.slice(1).toLowerCase() : t)

// ── Kontaktdaten ────────────────────────────────────────────────────────────

const reEmail = /[\w.+-]+@[\w-]+(\.[\w-]+)+/
const reWeb = /\b(https?:\/\/\S+|www\.\S+|(?:[\w-]+\.)?(?:linkedin|xing|github)\.com\/\S+)/i
const rePhone = /(?:\+\d{1,3}[\s/-]?)?(?:\(0\)\s?)?\(?\d{2,5}\)?[\s/-]?\d[\d\s/-]{4,}\d/
const reBirth = /(?:geb(?:oren|\.)?(?:\s+am)?|geburtsdatum(?:\s*(?:\/|und)\s*-?ort)?|date of birth|born)\s*:?\s*(\d{1,2}\.\s?\d{1,2}\.\s?\d{4}|\d{1,2}\.\s*[A-Za-zäÄ]+\s+\d{4})/i
const reStreet = /^[A-ZÄÖÜa-zäöü][\wäöüßÄÖÜ.\- ]*?(?:straße|strasse|str\.|weg|platz|allee|gasse|ring|damm|chaussee|ufer|steig|pfad|markt|road|street|avenue|lane)\s*\d+\s*[a-zA-Z]?$/i
const reCity = /^(?:D-?\s?)?(\d{5})\s+([A-ZÄÖÜ][\wäöüßÄÖÜ.\- ()]+)$/
const reLabel = /^(name|anschrift|adresse|wohnort|straße|telefon|tel\.?|mobil|handy|e-?mail|mail|geburtsdatum|geburtsort|geboren|staatsangehörigkeit|nationalität|familienstand|führerschein|web(?:site)?|internet|linkedin|xing|address|phone|mobile|date of birth|nationality|marital status)\s*:\s*(.+)$/i

const contactParts = (line: string) => line.split(/\s*[·|•]\s*|\s{2,}|,\s+(?=\+|\d{5}\s|[\w.+-]+@)/).map((p) => p.trim()).filter(Boolean)

function isNameLine(l: string): boolean {
  const words = l.split(/\s+/)
  return words.length >= 2 && words.length <= 4 && l.length <= 45 && words.every((w) => /^[A-ZÄÖÜ][a-zäöüßéèáçñ'’.-]*(-[A-ZÄÖÜ][a-zäöüß]*)?$/.test(w) || /^(von|van|de|zu|der|den|da|di|le)$/.test(w))
}

/** Liest Kontaktangaben aus einer Zeile; gibt `true` zurück, wenn die Zeile nur Kontaktdaten enthielt. */
function readContact(line: string, p: Partial<PersonalData>): boolean {
  const lab = reLabel.exec(line)
  if (lab) {
    const k = lab[1].toLowerCase()
    const v = lab[2].trim()
    if (k === 'name') p.name ||= v
    else if (/geburt|geboren|date of birth/.test(k)) p.birthDate ||= (reBirth.exec(`geb. ${v}`)?.[1] ?? v.split(/\s+in\s+/)[0]).trim()
    else if (/anschrift|adresse|wohnort|straße|address/.test(k)) readContact(v, p)
    else if (/tel|mobil|handy|phone|mobile/.test(k)) p.phone ||= v
    else if (/mail/.test(k)) p.email ||= reEmail.exec(v)?.[0] ?? v
    else if (/web|internet|linkedin|xing/.test(k)) p.website ||= v
    return true // Staatsangehörigkeit, Familienstand … werden bewusst nicht übernommen
  }
  let rest = 0
  for (const part of contactParts(line)) {
    const email = reEmail.exec(part)
    const web = reWeb.exec(part)
    const birth = reBirth.exec(part)
    const city = reCity.exec(part)
    const digits = part.replace(/\D/g, '').length
    if (email && part.length - email[0].length < 12) p.email ||= email[0]
    else if (web && !email) p.website ||= web[1]
    else if (birth) p.birthDate ||= birth[1]
    else if (reStreet.test(part)) p.address ||= part
    else if (city) {
      p.city ||= city[2].trim()
      if (p.address && !p.address.includes(city[1])) p.address = `${p.address}, ${part}`
      else p.address ||= part
    } else if (rePhone.test(part) && digits >= 7 && digits <= 16 && part.replace(/[\d\s+()/-]|tel\.?|telefon|mobil|handy|phone|mobile|:/gi, '').length === 0) p.phone ||= part.replace(/^(tel\.?|telefon|mobil|handy|phone|mobile)\s*:?\s*/i, '')
    else rest++
  }
  return rest === 0
}

// ── Lebenslauf ──────────────────────────────────────────────────────────────

export interface CvImport {
  personal: Partial<PersonalData>
  sections: CvSection[]
  signature: { place: string; date: string } | null
  /** Anzahl erkannter Überschriften (0 = keine Struktur gefunden) */
  headings: number
}

const reSignature = /^([A-ZÄÖÜ][\wäöüßÄÖÜ.\- ]{1,40}),\s*(?:den\s+)?(\d{1,2}\.\s?\d{1,2}\.\s?\d{2,4}|\d{1,2}\.\s*[A-Za-zäÄ]+\s+\d{4})$/

function paragraphs(lines: string[]): string {
  const paras: string[] = []
  let cur = ''
  for (const l of lines) {
    if (!l) {
      if (cur) paras.push(cur)
      cur = ''
    } else if (bullet.test(l)) {
      cur = cur ? `${cur}\n${l.replace(bullet, '- ')}` : l.replace(bullet, '- ')
    } else {
      // Zeilenumbruch mitten im Satz (PDF) → zusammenfügen; Trennstrich entfernen ("Umset-" + "zung"),
      // aber nicht bei Ergänzungsstrichen ("Wind-" + "und PV")
      if (!cur) cur = l
      else if (/[a-zäöüß][-‐]$/.test(cur) && /^[a-zäöü]/.test(l) && !/^(und|oder|bzw|bis|sowie|als)\b/.test(l)) cur = cur.slice(0, -1) + l
      else cur = `${cur} ${l}`
    }
  }
  if (cur) paras.push(cur)
  return paras.join('\n\n')
}

function splitOrg(line: string): { org: string; location: string } {
  const m = /^(.*?)(?:,|\s[|·–-]\s)\s*([A-ZÄÖÜ][\wäöüß. -]{1,28})$/.exec(line)
  if (m && !legalForm.test(m[2]) && !/\d/.test(m[2]) && m[2].split(' ').length <= 3) return { org: m[1].trim(), location: m[2].trim() }
  return { org: line, location: '' }
}

function buildEntry(d: { start: string; end: string }, rest: string[]): CvEntry {
  const e = { ...emptyEntry(), start: d.start, end: d.end }
  const lines = rest.filter(Boolean)
  let title = lines.shift() ?? ''
  // "Projektleiter bei Firma" / "Projektleiter, Firma GmbH"
  const bei = /^(.*?)\s+(?:bei|at|@)\s+(.+)$/.exec(title)
  if (bei) {
    title = bei[1]
    lines.unshift(bei[2])
  } else if (/,\s/.test(title) && legalForm.test(title.split(/,\s/).slice(1).join(', '))) {
    const [t, ...o] = title.split(/,\s/)
    title = t
    lines.unshift(o.join(', '))
  }
  e.title = title.replace(bullet, '')
  if (lines.length && !bullet.test(lines[0]) && lines[0].length <= 90 && !/^[^:]{2,25}:\s/.test(lines[0])) {
    const { org, location } = splitOrg(lines.shift()!)
    e.org = org
    e.location = location
  }
  e.description = paragraphs(lines)
  return e
}

function entriesOf(lines: string[], lang: Lang): CvEntry[] {
  const out: CvEntry[] = []
  let cur: { start: string; end: string; rest: string[] } | null = null
  const pre: string[] = []
  for (const l of joinWrappedDates(lines)) {
    const d = l ? matchDate(l, lang) : null
    if (d) {
      if (cur) out.push(buildEntry(cur, cur.rest))
      cur = { start: d.start, end: d.end, rest: d.rest ? [d.rest] : [] }
    } else if (cur) cur.rest.push(l)
    else pre.push(l)
  }
  if (cur) out.push(buildEntry(cur, cur.rest))
  if (!out.length) {
    // Keine Zeiträume gefunden: ein Eintrag pro Absatz
    const blocks: string[][] = [[]]
    for (const l of pre) l ? blocks[blocks.length - 1].push(l) : blocks.push([])
    return blocks.filter((b) => b.length).map((b) => buildEntry({ start: '', end: '' }, b))
  }
  const intro = paragraphs(pre)
  if (intro) out[0].description = [intro, out[0].description].filter(Boolean).join('\n\n')
  return out
}

function itemsOf(lines: string[]): CvItem[] {
  const out: CvItem[] = []
  const add = (name: string, level = '') => {
    name = tidy(name.replace(bullet, ''))
    if (name && name.length <= 80 && out.length < 40) out.push({ ...emptyItem(name, tidy(level)) })
  }
  for (const raw of lines) {
    if (!raw) continue
    const l = raw.replace(bullet, '')
    const label = /^([^:]{2,30}):\s*(.+)$/.exec(l)
    const values = (label ? label[2] : l).split(/\s*[•·|;▪]\s*|,\s+(?![^()]*\))|\s{2,}/).filter(Boolean)
    if (label && values.length === 1) {
      add(label[1], label[2])
      continue
    }
    for (const v of values) {
      const lvl = /^(.*?)\s*(?:\(([^)]+)\)|\s[–—-]\s+(.+))$/.exec(v)
      if (lvl) add(lvl[1], lvl[2] ?? lvl[3])
      else add(v)
    }
  }
  return out
}

/** Lebenslauf-Text → erkannte Kontaktdaten und Abschnitte. */
export function parseCv(text: string, lang: Lang = 'de'): CvImport {
  let lines = toLines(text)
  const personal: Partial<PersonalData> = {}
  let signature: CvImport['signature'] = null

  // Ort, Datum + Name am Ende ("Hamburg, 27.10.2026 / Jana Weber")
  for (let i = Math.max(0, lines.length - 6); i < lines.length; i++) {
    const m = reSignature.exec(lines[i])
    if (m) {
      signature = { place: m[1].trim(), date: m[2].replace(/\s/g, '') }
      lines = lines.slice(0, i)
      break
    }
  }

  // Blöcke je Überschrift
  const blocks: { kind: HeadingKind | 'head'; title: string; lines: string[] }[] = [{ kind: 'head', title: '', lines: [] }]
  let headings = 0
  for (const l of lines) {
    let h = l ? headingOf(l) : null
    // unbekannte GROSSBUCHSTABEN-Zeilen erst nach der ersten echten Überschrift (sonst z. B. Berufsbezeichnung im Kopf)
    if (h?.guessed && !headings) h = null
    if (h) headings++
    if (h) blocks.push({ kind: h.kind, title: h.title, lines: [] })
    else blocks[blocks.length - 1].lines.push(l)
  }

  // Kopfbereich + "Persönliche Daten": Name, Berufsbezeichnung, Kontakt
  const leftover: string[] = []
  for (const b of blocks.filter((b) => b.kind === 'head' || b.kind === 'personal')) {
    let label = '' // Word-Tabellen: "Geburtsdatum:" und Wert in getrennten Zellen
    for (const l of b.lines) {
      if (!l) continue
      if (/^[^:]{2,30}:$/.test(l) && reLabel.test(`${l} x`)) {
        label = l
        continue
      }
      const line = label && !reLabel.test(l) ? `${label} ${l}` : l
      label = ''
      if (line !== l && /^name:/i.test(line) && !personal.name) {
        personal.name = l
        continue
      }
      if (readContact(line, personal)) continue
      if (!personal.name && isNameLine(l)) personal.name = l
      else if (personal.name && !personal.headline && !leftover.length && l.length <= 80 && /[a-zäöü ]/.test(l)) personal.headline = l
      else leftover.push(l)
    }
  }
  const sections: CvSection[] = []
  const intro = paragraphs(leftover)
  for (const b of blocks) {
    if (b.kind === 'head' || b.kind === 'personal') continue
    const body = b.lines.filter((l, i, a) => l || (i > 0 && a[i - 1]))
    while (body.length && !body[body.length - 1]) body.pop()
    if (!body.length) continue
    const s = newSection(b.kind, lang)
    const custom = b.kind === 'custom'
    s.title = custom ? niceTitle(b.title) : sectionTitles[lang][b.kind]
    if (b.kind === 'profile') s.text = paragraphs(body)
    else if (b.kind === 'skills' || b.kind === 'languages' || b.kind === 'interests') s.items = itemsOf(body)
    else if (custom && !body.some((l) => l && matchDate(l, lang))) s.text = paragraphs(body)
    else s.entries = entriesOf(body, lang)
    // gleiche Art zweimal (z. B. "Praktika" + "Berufserfahrung") → zusammenführen
    const same = !custom && sections.find((x) => x.kind === s.kind)
    if (same) {
      same.entries.push(...s.entries)
      same.items.push(...s.items)
      same.text = [same.text, s.text].filter(Boolean).join('\n\n')
    } else sections.push(s)
  }
  if (intro && !sections.some((s) => s.kind === 'profile')) sections.unshift({ ...newSection('profile', lang), text: intro })

  // Kontaktdaten aus Seitenleisten o. Ä., falls nicht im Kopf
  if (!personal.email) personal.email = reEmail.exec(text)?.[0]
  return { personal, sections, signature, headings }
}

// ── Anschreiben ─────────────────────────────────────────────────────────────

const reSalutation = /^(sehr geehrte|sehr geehrter|liebe[rs]?\s|hallo|guten tag|moin|dear|hello|hi\s)/i
const reClosing = /^(mit (den )?(freundlichen|besten|herzlichen) grüßen|freundliche grüße|beste grüße|viele grüße|herzliche grüße|liebe grüße|kind regards|best regards|warm regards|regards|sincerely|yours (sincerely|faithfully|truly))[,.!]?$/i
const reDateLine = /^(?:([A-ZÄÖÜ][\wäöüß.\- ]{1,40}),\s*(?:den\s+)?)?(\d{1,2}\.\s?\d{1,2}\.\s?\d{2,4}|\d{1,2}\.\s*[A-Za-zäÄ]+\s+\d{4}|\d{1,2}\s+[A-Z][a-z]+\s+\d{4}|[A-Z][a-z]+\s+\d{1,2},\s+\d{4})$/
const reReference = /(ihre? (anzeige|stellenanzeige|zeichen|nachricht)|kennziffer|referenz(nummer)?|ref\.|stellen-?id|job-?id|your ref)/i
const reContactPerson = /^(z\.\s?h(d|än)?\.?|zu händen|frau|herrn?|personalabteilung|human resources|recruiting|attn\.?)/i

export interface LetterImport {
  sender: Partial<LetterContent['sender']>
  recipient: Partial<LetterContent['recipient']>
  place: string
  date: string
  subject: string
  reference: string
  salutation: string
  body: string
  closing: string
  signatureName: string
  attachments: string
}

/** Fließtext eines Briefs in Absätze teilen (Word: Leerzeilen; PDF: Satzende + kurze Zeile). */
function letterParagraphs(lines: string[]): string {
  if (lines.some((l) => !l)) return paragraphs(lines)
  const max = Math.max(...lines.map((l) => l.length))
  const out: string[] = []
  for (const l of lines) {
    out.push(l)
    if (/[.!?:]$/.test(l) && l.length < max * 0.8) out.push('')
  }
  return paragraphs(out)
}

/** Anschreiben-Text → erkannte Briefteile. */
export function parseLetter(text: string): LetterImport {
  const lines = toLines(text)
  const r: LetterImport = { sender: {}, recipient: {}, place: '', date: '', subject: '', reference: '', salutation: '', body: '', closing: '', signatureName: '', attachments: '' }
  const sal = lines.findIndex((l) => reSalutation.test(l))
  const clo = lines.findIndex((l, i) => i > sal && reClosing.test(l))
  const headEnd = sal >= 0 ? sal : 0

  // Datum, Betreff, Bezug direkt vor der Anrede
  let dateIdx = -1
  for (let i = headEnd - 1; i >= 0; i--) {
    const m = reDateLine.exec(lines[i])
    if (m) {
      dateIdx = i
      r.place = m[1]?.trim() ?? ''
      r.date = m[2]
      break
    }
  }
  const between = lines.slice(Math.max(dateIdx + 1, 0), headEnd).filter(Boolean)
  for (const l of between) {
    const clean = l.replace(/^(betreff|betr\.|subject|re)\s*:\s*/i, '')
    if (reReference.test(clean) && r.subject) r.reference ||= clean
    else if (!r.subject && !reDateLine.test(clean) && clean.length <= 160) r.subject = clean
    else if (r.subject && !r.reference) r.reference = clean
  }
  if (sal >= 0) r.salutation = lines[sal]

  // Brieftext
  const bodyLines = sal >= 0 ? lines.slice(sal + 1, clo > 0 ? clo : undefined) : lines
  r.body = letterParagraphs(bodyLines).replace(/^\s+|\s+$/g, '')

  // Gruß, Name, Anlagen
  if (clo > 0) {
    r.closing = lines[clo].replace(/,$/, '')
    const after = lines.slice(clo + 1).filter(Boolean)
    const att = after.findIndex((l) => /^anlage(n)?\b|^attachments?\b|^enclosures?\b/i.test(l))
    const names = att >= 0 ? after.slice(0, att) : after
    r.signatureName = names.find((l) => isNameLine(l)) ?? names[0] ?? ''
    if (att >= 0) {
      const first = after[att].replace(/^(anlage(n)?|attachments?|enclosures?)\s*:?\s*/i, '')
      r.attachments = [first, ...after.slice(att + 1)].map((l) => l.replace(bullet, '').trim()).filter(Boolean).join(', ')
    }
  }

  // Briefkopf: Absender- und Empfängerblock (je bis zur Zeile mit PLZ + Ort)
  const head = lines.slice(0, dateIdx >= 0 ? dateIdx : headEnd)
  const blocks: string[][] = []
  let cur: string[] = []
  for (const l of head) {
    if (!l) {
      if (cur.length) blocks.push(cur)
      cur = []
      continue
    }
    // E-Mail/Telefon direkt nach "PLZ Ort" gehören noch zum vorherigen Block
    if (!cur.length && blocks.length && readContact(l, {}) && !reCity.test(l)) {
      blocks[blocks.length - 1].push(l)
      continue
    }
    if (/^(.*?)\s*[·|•,]\s*\d{5}\s/.test(l) && cur.length === 0 && blocks.length === 0) {
      // Rücksendezeile "Max Muster · Weg 1 · 12345 Ort" → Absender
      continue
    }
    cur.push(l)
    if (contactParts(l).some((p) => reCity.test(p))) {
      blocks.push(cur)
      cur = []
    }
  }
  if (cur.length) blocks.push(cur)
  const looksRecipient = (b: string[]) => b.some((l) => legalForm.test(l) || reContactPerson.test(l))
  let senderBlock = blocks.find((b) => !looksRecipient(b) && b.some((l) => reEmail.test(l) || rePhone.test(l) || isNameLine(l)))
  const recipientBlock = blocks.find((b) => b !== senderBlock && (looksRecipient(b) || blocks.length > 1))
  if (!senderBlock && blocks.length > 1) senderBlock = blocks.find((b) => b !== recipientBlock)

  if (senderBlock) {
    const p: Partial<PersonalData> = {}
    const extra: string[] = []
    for (const l of senderBlock) if (!readContact(l, p)) extra.push(l)
    r.sender = { name: extra.find(isNameLine) ?? '', street: p.address?.split(',')[0] ?? '', city: contactParts(senderBlock.join('  ')).find((x) => reCity.test(x)) ?? '', phone: p.phone ?? '', email: p.email ?? '' }
  }
  if (recipientBlock) {
    const rec: LetterImport['recipient'] = {}
    for (const l of recipientBlock) {
      if (reCity.test(l)) rec.city = l
      else if (reStreet.test(l) || /^postfach\s+\d+/i.test(l)) rec.street = l
      else if (reContactPerson.test(l) && !legalForm.test(l)) rec.contact = rec.contact ? `${rec.contact}\n${l}` : l
      else if (!rec.company) rec.company = l
      else rec.contact = rec.contact ? `${rec.contact}\n${l}` : l
    }
    r.recipient = rec
  }
  return r
}

/** Grobe Einordnung: Brief (Anrede + Gruß) oder Lebenslauf. */
export function guessType(text: string): 'cv' | 'cover_letter' {
  const lines = toLines(text)
  const letter = lines.some((l) => reSalutation.test(l)) && lines.some((l) => reClosing.test(l))
  const headings = lines.filter((l) => {
    const h = l && headingOf(l)
    return h && h.kind !== 'custom'
  }).length
  return letter && headings < 3 ? 'cover_letter' : 'cv'
}

// ── Zusammenführen mit Profil / Vorlage ─────────────────────────────────────

const pick = <T extends object>(base: T, imported: Partial<T>, keepBase: boolean): T => {
  const out = { ...base }
  for (const [k, v] of Object.entries(imported) as [keyof T, T[keyof T]][]) {
    if (typeof v !== 'string' || !v.trim()) continue
    if (keepBase && typeof base[k] === 'string' && (base[k] as string).trim()) continue
    out[k] = v.trim() as T[keyof T]
  }
  return out
}

export interface ImportSummary {
  name: boolean
  contact: number
  sections: { kind: SectionKind; title: string; count: number }[]
  /** Lebenslauf: keine Überschriften erkannt → Text steht im Profil-Abschnitt */
  fallback: boolean
  /** Name aus der Datei (Lebenslauf: Kopf, Brief: Absender/Unterschrift) */
  person: string
  /** Datei gehört offenbar zu einer anderen Person als das aktive Profil */
  otherPerson: boolean
}

const normName = (s: string) => s.toLowerCase().replace(/[^a-zäöüß]/g, '')

/** Andere Person? (Name in der Datei ≠ Name des aktiven Profils) */
function isOtherPerson(found: string | undefined, profile: Partial<Profile> | null): boolean {
  return !!found && !!profile?.name && normName(found) !== normName(profile.name)
}

/**
 * Baut aus dem Text einen vollständigen Dokumentinhalt.
 * Vorhandene Profildaten haben Vorrang (sie sind aktueller als ein altes Dokument),
 * erkannte Werte füllen die Lücken. Fehlende Kernabschnitte werden leer ergänzt,
 * damit man sie im Editor direkt ausfüllen kann.
 */
export function buildImportedContent(
  type: 'cv' | 'cover_letter',
  text: string,
  profile: Partial<Profile> | null,
  lang: Lang = 'de'
): { content: CvContent | LetterContent; summary: ImportSummary } {
  if (type === 'cv') {
    const imp = parseCv(text, lang)
    const other = isOtherPerson(imp.personal.name, profile)
    // gehört die Datei zu jemand anderem, gelten nur ihre eigenen Angaben
    if (other) profile = null
    const base = createContent('cv', profile, lang) as CvContent
    const personal = pick(base.personal, imp.personal, true)
    let sections = imp.sections
    const fallback = imp.headings === 0
    if (!sections.length) sections = [{ ...newSection('custom', lang), title: lang === 'de' ? 'Importierter Text' : 'Imported text', text: paragraphs(toLines(text)) }]
    for (const kind of ['experience', 'education', 'skills'] as const) {
      if (!sections.some((s) => s.kind === kind)) sections.push(kind === 'skills' ? { ...newSection(kind, lang), items: [emptyItem()] } : { ...newSection(kind, lang), entries: [emptyEntry()] })
    }
    const content: CvContent = {
      ...base,
      personal,
      sections,
      signature: imp.signature ? { show: true, place: base.signature.place || imp.signature.place, date: base.signature.date } : base.signature
    }
    const contact = (['email', 'phone', 'address', 'city', 'birthDate', 'website'] as const).filter((k) => imp.personal[k]).length
    return {
      content,
      summary: {
        name: !!imp.personal.name,
        contact,
        fallback,
        person: imp.personal.name ?? '',
        otherPerson: other,
        sections: imp.sections.map((s) => ({ kind: s.kind, title: s.title, count: s.entries.length || s.items.length || (s.text ? 1 : 0) }))
      }
    }
  }
  const imp = parseLetter(text)
  const person = imp.sender.name || imp.signatureName
  const other = isOtherPerson(person, profile)
  if (other) profile = null
  const base = createContent('cover_letter', profile, lang) as LetterContent
  const content: LetterContent = {
    ...base,
    sender: pick(base.sender, imp.sender, true),
    recipient: pick(base.recipient, imp.recipient, false),
    place: base.place || imp.place,
    subject: imp.subject || base.subject,
    reference: imp.reference,
    salutation: imp.salutation || base.salutation,
    body: imp.body || base.body,
    closing: imp.closing || base.closing,
    signatureName: base.signatureName || imp.signatureName,
    attachments: imp.attachments || base.attachments
  }
  const found = (['subject', 'salutation', 'body', 'closing', 'attachments'] as const).filter((k) => imp[k]).length
  return {
    content,
    summary: {
      name: !!imp.signatureName,
      contact: Object.values(imp.sender).filter(Boolean).length,
      fallback: !imp.body,
      person,
      otherPerson: other,
      sections: [
        { kind: 'custom', title: 'recipient', count: Object.values(imp.recipient).filter(Boolean).length },
        { kind: 'custom', title: 'letter', count: found }
      ]
    }
  }
}
