/**
 * Wurzelkomponente: lädt Einstellungen, wendet Theme & Sprache an, verbindet Menüaktionen.
 */
import { useEffect } from 'react'
import { useApp } from '@/store/app'
import { applyTheme } from '@/theme/tokens'
import { setLanguage } from '@/i18n'
import { AppShell } from '@/components/layout/AppShell'

export function App() {
  const ready = useApp((s) => s.ready)
  const settings = useApp((s) => s.settings)
  const init = useApp((s) => s.init)

  useEffect(() => {
    void init()
  }, [init])

  // Theme + Sprache bei jeder Einstellungsänderung live anwenden
  useEffect(() => {
    applyTheme({
      palette: settings.accentPalette,
      fontPair: settings.fontPair,
      intensity: settings.themeIntensity,
      glow: settings.glowEffects,
      reducedEffects: settings.reducedEffects,
      scanlines: settings.scanlines
    })
    setLanguage(settings.language)
  }, [settings])

  // Menüaktionen aus dem Main-Process
  useEffect(
    () =>
      window.docforge.onMenuAction((action) => {
        const { navigate, setAboutOpen } = useApp.getState()
        if (action === 'about') setAboutOpen(true)
        else navigate(action.replace('navigate:', '') as Parameters<typeof navigate>[0])
      }),
    []
  )

  if (!ready) return <div className="app-grid h-full" />
  return <AppShell />
}
