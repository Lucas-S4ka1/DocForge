/**
 * Grundlayout: Seitenleiste links, aktiver Screen rechts, Raster-Hintergrund.
 */
import { useApp } from '@/store/app'
import { Sidebar } from './Sidebar'
import { AboutDialog } from './AboutDialog'
import { HubScreen } from '@/screens/HubScreen'
import { EditorScreen } from '@/screens/EditorScreen'
import { StudioScreen } from '@/screens/StudioScreen'
import { ArchiveScreen } from '@/screens/ArchiveScreen'
import { SettingsScreen } from '@/screens/SettingsScreen'

const screens = {
  hub: HubScreen,
  editor: EditorScreen,
  studio: StudioScreen,
  archive: ArchiveScreen,
  settings: SettingsScreen
} as const

export function AppShell() {
  const screen = useApp((s) => s.screen)
  const Screen = screens[screen]
  return (
    <div className="app-grid relative flex h-full w-full overflow-hidden text-accent-100">
      <Sidebar />
      <div key={screen} className="flex min-w-0 flex-1 flex-col">
        <Screen />
      </div>
      <AboutDialog />
    </div>
  )
}
