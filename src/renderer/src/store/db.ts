/**
 * Daten-Zugriff im Renderer.
 * - `db` = typisierte IPC-API (window.docforge.db)
 * - `useQuery` lädt Daten und lädt automatisch neu, sobald irgendwo geschrieben wurde
 * - `mutate` führt eine Schreiboperation aus und stößt das Neuladen an
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { create } from 'zustand'
import { ipcErrorCode } from '@shared/ipc'

export const db = window.docforge.db

interface DbState {
  /** Wird nach jeder Schreiboperation erhöht → alle Queries laden neu. */
  version: number
  bump(): void
}

export const useDbState = create<DbState>((set) => ({
  version: 0,
  bump: () => set((s) => ({ version: s.version + 1 }))
}))

// Externe Änderungen (z. B. Wiederherstellung eines Backups)
window.docforge.onDbChanged(() => useDbState.getState().bump())

export function useQuery<T>(fn: () => Promise<T>, deps: unknown[]): { data: T | undefined; loading: boolean; error: string | null; reload(): void } {
  const version = useDbState((s) => s.version)
  const [data, setData] = useState<T>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(() => {
    let alive = true
    setLoading(true)
    fnRef
      .current()
      .then((d) => alive && (setData(d), setError(null)))
      .catch((e) => alive && setError(ipcErrorCode(e)))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, tick, ...deps])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data, loading, error, reload }
}

/** Schreiboperation ausführen und anschließend alle Ansichten aktualisieren. */
export async function mutate<T>(op: () => Promise<T>): Promise<T> {
  const r = await op()
  useDbState.getState().bump()
  return r
}
