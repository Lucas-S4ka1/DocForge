/**
 * i18n-Setup (i18next). Deutsch ist Standard, Englisch optional.
 * Neue Sprache: Datei in ./locales anlegen (Typ `Messages`) und unten registrieren.
 */
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import de from './locales/de'
import en from './locales/en'
import type { Language } from '@shared/settings'

export const languages: { code: Language; label: string }[] = [
  { code: 'de', label: 'Deutsch' },
  { code: 'en', label: 'English' }
]

void i18n.use(initReactI18next).init({
  resources: { de: { translation: de }, en: { translation: en } },
  lng: 'de',
  fallbackLng: 'de',
  interpolation: { escapeValue: false },
  showSupportNotice: false
})

export function setLanguage(lang: Language): void {
  if (i18n.language !== lang) void i18n.changeLanguage(lang)
  document.documentElement.lang = lang
}

/** Datumsformat passend zur Sprache, z. B. "Mo 26.10.2026". */
export function formatSessionDate(date: Date, lang: Language): string {
  const locale = lang === 'de' ? 'de-DE' : 'en-GB'
  const wd = date.toLocaleDateString(locale, { weekday: 'short' }).replace('.', '')
  const d = date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
  return `${wd} ${d}`
}

export default i18n
