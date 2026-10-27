/**
 * KI-Befehlsleiste: gemeinsame Typen und die (reine) Logik zum Anwenden der von Claude
 * vorgeschlagenen Änderungen. Claude liefert Änderungen als JSON-Pointer + neuer Wert;
 * jede Änderung kann einzeln übernommen oder verworfen werden.
 */
import { isDocContent, uid, type DocContent } from './document'

/** Auswählbare Modelle (Einstellungen). Standard: Claude Opus 5.5. */
export const claudeModels = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', fallback: true },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', fallback: true },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', fallback: false }
] as const
export type ClaudeModelId = (typeof claudeModels)[number]['id']
export const defaultClaudeModel: ClaudeModelId = 'claude-opus-5-5'
export const isClaudeModel = (v: unknown): v is ClaudeModelId => claudeModels.some((m) => m.id === v)

export type ChangeAction = 'replace' | 'insert' | 'remove'

/** Eine von Claude vorgeschlagene Änderung (so wie sie von der API kommt). */
export interface AiChange {
  label: string
  /** JSON Pointer (RFC 6901) in den Dokumentinhalt, z. B. "/sections/1/entries/0/description" */
  path: string
  action: ChangeAction
  /** neuer Wert als JSON-Text (bei "remove" leer) */
  new_value_json: string
}

export interface AiResult {
  summary: string
  changes: AiChange[]
  /** Anforderungen aus der Stellenanzeige, die das Dokument abdeckt */
  matched_keywords: string[]
  /** Anforderungen, die (noch) nicht im Dokument/Profil stehen – werden NICHT erfunden */
  missing_keywords: string[]
  model: string
  /** true, wenn ein Ersatzmodell geantwortet hat (Ablehnung des gewählten Modells) */
  usedFallback: boolean
}

export interface AiStatus {
  hasKey: boolean
  /** Verschlüsselung über das Betriebssystem verfügbar (sonst wird kein Key gespeichert) */
  encryptionAvailable: boolean
  /** letzte 4 Zeichen zur Wiedererkennung */
  keyHint: string | null
}

export interface AiRunInput {
  documentId: number
  command: string
  jobPosting?: string | null
}

/** Fehlercodes der KI-Funktion (für verständliche Meldungen im Renderer). */
export type AiErrorCode =
  | 'AI_NO_KEY'
  | 'AI_AUTH'
  | 'AI_RATE'
  | 'AI_OVERLOADED'
  | 'AI_OFFLINE'
  | 'AI_REFUSED'
  | 'AI_TOO_LONG'
  | 'AI_BAD_REQUEST'
  | 'AI_CANCELLED'
  | 'AI_NO_ENCRYPTION'
  | 'AI_FAILED'

// ── JSON Pointer ────────────────────────────────────────────────────────────

export function parsePointer(path: string): string[] {
  if (path === '' || path === '/') return []
  if (!path.startsWith('/')) throw new Error('Pointer must start with /')
  return path
    .slice(1)
    .split('/')
    .map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'))
}

export function getAt(root: unknown, path: string): unknown {
  let cur: unknown = root
  for (const key of parsePointer(path)) {
    if (cur === null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[key]
  }
  return cur
}

/** Felder, die die KI nicht ändern darf (Gestaltung, Foto, Typ). */
export function isProtectedPath(path: string): boolean {
  return /^\/(style|kind)(\/|$)/.test(path) || /\/id$/.test(path)
}

/** Neue Listeneinträge bekommen eine ID und fehlende Felder (CV-Einträge/Items). */
function withIds(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withIds)
  if (value && typeof value === 'object') {
    const o = { ...(value as Record<string, unknown>) }
    for (const k of Object.keys(o)) o[k] = withIds(o[k])
    const looksLikeEntry = 'title' in o || 'org' in o || 'description' in o
    const looksLikeItem = 'name' in o && 'level' in o
    if ((looksLikeEntry || looksLikeItem) && typeof o.id !== 'string') o.id = uid()
    if (looksLikeEntry) for (const k of ['title', 'org', 'location', 'start', 'end', 'description']) if (typeof o[k] !== 'string') o[k] = ''
    return o
  }
  return value
}

/** Wendet eine Änderung auf eine Kopie an. Wirft bei ungültigem Pfad/Wert. */
export function applyChange(content: DocContent, change: AiChange): DocContent {
  if (isProtectedPath(change.path)) throw new Error('Protected path')
  const next = structuredClone(content) as unknown as Record<string, unknown>
  const keys = parsePointer(change.path)
  if (keys.length === 0) throw new Error('Root change not allowed')
  const last = keys[keys.length - 1]
  let parent: unknown = next
  for (const k of keys.slice(0, -1)) {
    if (parent === null || typeof parent !== 'object') throw new Error('Invalid path')
    parent = (parent as Record<string, unknown>)[k]
  }
  if (parent === null || typeof parent !== 'object') throw new Error('Invalid path')

  const value = change.action === 'remove' ? undefined : withIds(JSON.parse(change.new_value_json))

  if (Array.isArray(parent)) {
    const idx = last === '-' ? parent.length : Number(last)
    if (!Number.isInteger(idx) || idx < 0 || idx > parent.length) throw new Error('Invalid index')
    if (change.action === 'insert') parent.splice(idx, 0, value)
    else if (change.action === 'remove') {
      if (idx >= parent.length) throw new Error('Invalid index')
      parent.splice(idx, 1)
    } else {
      if (idx >= parent.length) throw new Error('Invalid index')
      // Typ muss passen (Text bleibt Text, Objekt bleibt Objekt)
      if (typeof parent[idx] !== typeof value) throw new Error('Type mismatch')
      parent[idx] = value
    }
  } else {
    const obj = parent as Record<string, unknown>
    if (change.action === 'remove') {
      if (!(last in obj)) throw new Error('Missing field')
      // Textfelder werden geleert statt gelöscht, damit die Struktur gültig bleibt
      if (typeof obj[last] === 'string') obj[last] = ''
      else if (Array.isArray(obj[last])) obj[last] = []
      else throw new Error('Cannot remove field')
    } else {
      if (!(last in obj)) throw new Error('Unknown field')
      if (typeof obj[last] !== typeof value || Array.isArray(obj[last]) !== Array.isArray(value)) throw new Error('Type mismatch')
      obj[last] = value
    }
  }
  const result = next as unknown as DocContent
  if (!isDocContent(result) || result.kind !== content.kind) throw new Error('Invalid result')
  return result
}

/**
 * Prüft alle Änderungen einzeln gegen das Original. Ungültige werden aussortiert
 * (z. B. falscher Pfad), damit eine fehlerhafte Änderung nicht den Rest blockiert.
 */
export function validateChanges(content: DocContent, changes: AiChange[]): { valid: AiChange[]; invalid: number } {
  const valid: AiChange[] = []
  let invalid = 0
  for (const c of changes) {
    try {
      applyChange(content, c)
      valid.push(c)
    } catch {
      invalid++
    }
  }
  return { valid, invalid }
}

/**
 * Wendet die ausgewählten Änderungen nacheinander an. Einfügungen/Entfernungen in Listen
 * verschieben spätere Indizes – deshalb werden Änderungen an derselben Liste von hinten
 * nach vorne angewendet (höchster Index zuerst), Ersetzungen zuerst.
 */
export function applyChanges(content: DocContent, changes: AiChange[]): DocContent {
  const order = (c: AiChange) => (c.action === 'replace' ? 0 : 1)
  const idx = (c: AiChange) => {
    const last = parsePointer(c.path).pop() ?? ''
    return last === '-' ? Number.MAX_SAFE_INTEGER : Number(last) || 0
  }
  const sorted = [...changes].sort((a, b) => order(a) - order(b) || idx(b) - idx(a))
  let cur = content
  for (const c of sorted) {
    try {
      cur = applyChange(cur, c)
    } catch {
      // Konflikt mit einer vorherigen Änderung → diese überspringen
    }
  }
  return cur
}

/** Inhalt ohne Gestaltung – das bekommt Claude zu sehen. */
export function contentForAi(content: DocContent): Omit<DocContent, 'style'> {
  const { style: _style, ...rest } = content
  return rest
}

// ── Diff (Wort-Ebene) ──────────────────────────────────────────────────────

export type DiffPart = { type: 'same' | 'add' | 'del'; text: string }

/** Lesbarer Text für beliebige Werte (Einträge, Listen) – Grundlage für den Diff. */
export function toReadable(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(toReadable).filter(Boolean).join('\n')
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>
    if ('name' in o) return [o.name, o.level ? `(${String(o.level)})` : ''].filter(Boolean).join(' ')
    const head = [o.title, o.org, o.location].filter((x) => typeof x === 'string' && x).join(' · ')
    const dates = [o.start, o.end].filter((x) => typeof x === 'string' && x).join(' – ')
    return [head, dates, typeof o.description === 'string' ? o.description : '', typeof o.text === 'string' ? o.text : '']
      .filter(Boolean)
      .join('\n')
  }
  return String(value)
}

/** Einfacher LCS-Diff auf Wortebene (Leerzeichen bleiben erhalten). */
export function wordDiff(before: string, after: string): DiffPart[] {
  const a = before.split(/(\s+)/).filter((x) => x !== '')
  const b = after.split(/(\s+)/).filter((x) => x !== '')
  // Bei sehr langen Texten: grober Block-Diff, um die UI nicht zu blockieren
  if (a.length * b.length > 4_000_000) return [{ type: 'del', text: before }, { type: 'add', text: after }]
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
  const out: DiffPart[] = []
  const push = (type: DiffPart['type'], text: string) => {
    const lastPart = out[out.length - 1]
    if (lastPart && lastPart.type === type) lastPart.text += text
    else out.push({ type, text })
  }
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push('same', a[i])
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) push('del', a[i++])
    else push('add', b[j++])
  }
  while (i < a.length) push('del', a[i++])
  while (j < b.length) push('add', b[j++])
  return mergeWhitespace(out)
}

/**
 * Glättet den Diff: Reine Leerzeichen zwischen zwei Änderungen werden Teil der Änderung,
 * damit "Hallo zusammen," als ein gestrichener Block erscheint statt als zwei.
 */
function mergeWhitespace(parts: DiffPart[]): DiffPart[] {
  const changed = (p?: DiffPart) => !!p && p.type !== 'same'
  const out: DiffPart[] = []
  for (let k = 0; k < parts.length; k++) {
    const p = parts[k]
    if (p.type === 'same' && /^\s+$/.test(p.text) && changed(parts[k - 1]) && changed(parts[k + 1])) {
      out.push({ type: 'del', text: p.text }, { type: 'add', text: p.text })
    } else out.push({ ...p })
  }
  // Gleichartige Nachbarn zusammenfassen; Reihenfolge: alle Streichungen vor den Ergänzungen eines Blocks
  const merged: DiffPart[] = []
  let k = 0
  while (k < out.length) {
    if (out[k].type === 'same') {
      merged.push(out[k++])
      continue
    }
    let del = ''
    let add = ''
    while (k < out.length && out[k].type !== 'same') {
      if (out[k].type === 'del') del += out[k].text
      else add += out[k].text
      k++
    }
    if (del) merged.push({ type: 'del', text: del })
    if (add) merged.push({ type: 'add', text: add })
  }
  return merged
}
