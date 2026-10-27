/**
 * Grundlayout: Seitenleiste links, aktiver Screen rechts, Raster-Hintergrund.
 */
import { useApp } from '@/store/app'
import { Sidebar } from './Sidebar'
import { AboutDialog } from './AboutDialog'
import { Toaster } from '../ui/Toaster'
import { UpdateDialog } from './UpdateDialog'
import { ProfileForm } from '@/screens/archive/forms'
import { createAndOpen } from '@/lib/newDocument'
import { HubScreen } from '@/screens/HubScreen'
import { EditorScreen } from '@/screens/editor/EditorScreen'
import { StudioScreen } from '@/screens/StudioScreen'
import { ArchiveScreen } from '@/screens/archive/ArchiveScreen'
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
  const pending = useApp((s) => s.pendingCreate)
  const setPending = useApp((s) => s.setPendingCreate)
  const updateSettings = useApp((s) => s.updateSettings)
  return (
    <div className="app-grid relative flex h-full w-full overflow-hidden text-accent-100">
      <Sidebar />
      <div key={screen} className="flex min-w-0 flex-1 flex-col">
        <Screen />
      </div>
      <AboutDialog />
      <Toaster />
      <UpdateDialog />
      {pending && (
        <ProfileForm
          onClose={() => setPending(null)}
          onSaved={async (p) => {
            await updateSettings({ activeProfileId: p.id })
            const { type, applicationId } = pending
            setPending(null)
            await createAndOpen(type, { applicationId })
          }}
        />
      )}
    </div>
  )
}
