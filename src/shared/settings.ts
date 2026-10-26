/**
 * App-Einstellungen (werden im Main-Process als JSON im Nutzerdatenordner gespeichert).
 * Geteilt zwischen Main und Renderer, damit beide denselben Typ/Defaultwert kennen.
 */

export type Language = 'de' | 'en'
export type AccentPaletteSetting = 'steel' | 'neon'
export type FontPairSetting = 'design' | 'rajdhani' | 'exo'
export type BackupInterval = 'off' | 'daily' | 'weekly'

export interface AppSettings {
  language: Language
  /** Glow-Stärke 0–100 ("Theme-Intensität" im Design). */
  themeIntensity: number
  glowEffects: boolean
  /** Schaltet Glow und Animationen komplett ab. */
  reducedEffects: boolean
  scanlines: boolean
  accentPalette: AccentPaletteSetting
  fontPair: FontPairSetting
  autoBackup: BackupInterval
  /** Automatisch beim Start nach Updates suchen. */
  checkUpdatesOnStart: boolean
  /** Gewähltes Claude-Modell für die Befehlsleiste (Phase 5). */
  claudeModel: string
}

export const defaultSettings: AppSettings = {
  language: 'de',
  themeIntensity: 70,
  glowEffects: true,
  reducedEffects: false,
  scanlines: true,
  accentPalette: 'steel',
  fontPair: 'design',
  autoBackup: 'weekly',
  checkUpdatesOnStart: true,
  claudeModel: 'claude-sonnet-5-5'
}

/** Prüft und bereinigt teilweise/unbekannte Einstellungen (z. B. aus einer alten Datei). */
export function sanitizeSettings(input: unknown): AppSettings {
  const src = (input && typeof input === 'object' ? input : {}) as Partial<AppSettings>
  const pick = <K extends keyof AppSettings>(key: K, valid: (v: unknown) => boolean): AppSettings[K] =>
    valid(src[key]) ? (src[key] as AppSettings[K]) : defaultSettings[key]
  const oneOf = (...vals: unknown[]) => (v: unknown) => vals.includes(v)
  const isBool = (v: unknown) => typeof v === 'boolean'

  return {
    language: pick('language', oneOf('de', 'en')),
    themeIntensity: pick('themeIntensity', (v) => typeof v === 'number' && v >= 0 && v <= 100),
    glowEffects: pick('glowEffects', isBool),
    reducedEffects: pick('reducedEffects', isBool),
    scanlines: pick('scanlines', isBool),
    accentPalette: pick('accentPalette', oneOf('steel', 'neon')),
    fontPair: pick('fontPair', oneOf('design', 'rajdhani', 'exo')),
    autoBackup: pick('autoBackup', oneOf('off', 'daily', 'weekly')),
    checkUpdatesOnStart: pick('checkUpdatesOnStart', isBool),
    claudeModel: pick('claudeModel', (v) => typeof v === 'string' && v.length > 0 && v.length < 100)
  }
}
