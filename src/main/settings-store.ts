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
    const raw = existsSync(file()) ? JSON.parse(readFileSync(file(), 'utf8')) : null
    cache = raw ? sanitizeSettings(raw) : { ...defaultSettings }
    // Einmalige Migration: Bis 1.1 war das Modell intern auf Sonnet voreingestellt, aber nicht
    // auswählbar → auf den neuen Standard umstellen. Danach gilt die Auswahl der Nutzerin.
    if (raw && !raw.modelChosen) cache = { ...cache, claudeModel: defaultSettings.claudeModel }
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
  writeFileSync(tmp, JSON.stringify({ ...next, modelChosen: true }, null, 2), 'utf8')
  renameSync(tmp, file())
  cache = next
  return next
}
