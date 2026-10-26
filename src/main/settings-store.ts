/**
 * Einfacher, robuster Einstellungs-Speicher als JSON-Datei im Nutzerdatenordner.
 * Schreibt atomar (temp-Datei + rename), damit ein Absturz die Datei nie halb zurücklässt.
 * Hinweis: Der API-Key wird NICHT hier, sondern separat mit safeStorage verschlüsselt gespeichert.
 */
import { app } from 'electron'
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { defaultSettings, sanitizeSettings, type AppSettings } from '@shared/settings'

const file = () => join(app.getPath('userData'), 'settings.json')

let cache: AppSettings | null = null

export function loadSettings(): AppSettings {
  if (cache) return cache
  try {
    cache = existsSync(file()) ? sanitizeSettings(JSON.parse(readFileSync(file(), 'utf8'))) : { ...defaultSettings }
  } catch {
    // Beschädigte Datei → mit Standardwerten weiterarbeiten (keine Inhalte loggen).
    console.warn('[settings] Einstellungsdatei unlesbar, Standardwerte werden verwendet.')
    cache = { ...defaultSettings }
  }
  return cache
}

export function saveSettings(patch: Partial<AppSettings>): AppSettings {
  const next = sanitizeSettings({ ...loadSettings(), ...patch })
  const tmp = `${file()}.tmp`
  writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf8')
  renameSync(tmp, file())
  cache = next
  return next
}
