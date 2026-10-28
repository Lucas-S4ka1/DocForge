/**
 * Wurzelkomponente: lädt Einstellungen, wendet Theme & Sprache an, verbindet Menüaktionen.
 */
import { useEffect } from 'react'
import { useApp } from '@/store/app'
import { applyTheme } from '@/theme/tokens'
import { setLanguage } from '@/i18n'
import { AppShell } from '@/components/layout/AppShell'
import { requestCreate } from '@/lib/requestCreate'
import { useImport } from '@/store/importer'
import { db, useQuery } from '@/store/db'

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
        else if (action === 'new:cv') void requestCreate('cv')
        else if (action === 'new:letter') void requestCreate('cover_letter')
        else if (action === 'import') void useImport.getState().begin()
        else navigate(action.replace('navigate:', '') as Parameters<typeof navigate>[0])
      }),
    []
  )

  // Immer ein gültiges aktives Profil: fehlt es (oder wurde gelöscht), das erste vorhandene wählen
  const profiles = useQuery(() => (ready ? db.profiles.list() : Promise.resolve([])), [ready]).data
  useEffect(() => {
    if (!ready || !profiles) return
    const active = settings.activeProfileId
    if (profiles.length > 0 && !profiles.some((p) => p.id === active)) void useApp.getState().updateSettings({ activeProfileId: profiles[0].id })
    if (profiles.length === 0 && active) void useApp.getState().updateSettings({ activeProfileId: null })
  }, [ready, profiles, settings.activeProfileId])

  if (!ready) return <div className="app-grid h-full" />
  return <AppShell />
}
