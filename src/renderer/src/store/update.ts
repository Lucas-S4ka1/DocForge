/**
 * Update-Status (kommt vom Main-Process). `manual` = Nutzer hat selbst gesucht
 * → dann auch "kein Update"/"offline" anzeigen; bei der Prüfung beim Start nur echte Updates.
 */
import { create } from 'zustand'
import type { UpdateStatus } from '@shared/ipc'

interface UpdateState {
  status: UpdateStatus
  manual: boolean
  open: boolean
  check(): void
  dismiss(): void
}

export const useUpdate = create<UpdateState>((set) => ({
  status: { state: 'idle' },
  manual: false,
  open: false,
  check: () => {
    set({ manual: true, open: true, status: { state: 'checking' } })
    void window.docforge.updates.check()
  },
  dismiss: () => set({ open: false, manual: false })
}))

window.docforge.updates.onStatus((status) => {
  const { manual, open } = useUpdate.getState()
  const important = status.state === 'available' || status.state === 'downloading' || status.state === 'downloaded'
  useUpdate.setState({ status, open: open || important || manual })
})
