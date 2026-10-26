/**
 * Gemeinsame Teile der Archiv-Tabs: Detail-Panel, Abschnittslabel, Fehlertexte, Debounce.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ipcErrorCode } from '@shared/ipc'
import { Corners, EmptyState } from '@/components/ui/Panel'
import { toast } from '@/store/toast'
import { recordNo } from '@/lib/format'

export function RecordPanel({ id, children, actions }: { id?: number | null; children?: ReactNode; actions?: ReactNode }) {
  const { t } = useTranslation()
  return (
    <section className="blueprint flex min-h-0 flex-col gap-4 p-[18px]">
      <Corners />
      <div className="flex items-center gap-2">
        <span className="sys-label text-accent-400">
          {t('archive.record')} {id ? <span className="text-accent-300">{recordNo(id)}</span> : null}
        </span>
        {id ? <div className="ml-auto flex gap-1.5">{actions}</div> : null}
      </div>
      {id ? <div className="-mr-2 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-2">{children}</div> : <EmptyState hint={t('archive.noRecord')} />}
    </section>
  )
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="font-heading text-[11px] font-semibold uppercase tracking-system text-accent-400">{children}</div>
}

/** Kleiner Aktionsbutton im Detail-Panel. */
export function MiniButton({ children, onClick, danger, title }: { children: ReactNode; onClick(): void; danger?: boolean; title?: string }) {
  return (
    <button type="button" title={title} onClick={onClick} className={`btn px-2.5 py-1 text-[12px] ${danger ? 'hover:border-danger/70 hover:text-danger' : ''}`}>
      {children}
    </button>
  )
}

/** Führt eine Aktion aus und zeigt Fehler als Systemmeldung. */
export function useAction() {
  const { t } = useTranslation()
  return async <T,>(fn: () => Promise<T>, successText?: string): Promise<T | undefined> => {
    try {
      const r = await fn()
      if (successText) toast.success(successText)
      return r
    } catch (e) {
      toast.error(t(`errors.${ipcErrorCode(e)}`, { defaultValue: t('errors.INTERNAL') }))
      return undefined
    }
  }
}

export function useDebounced<T>(value: T, ms = 200): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return v
}

/** Leere Strings → null (für optionale DB-Felder). */
export function nullify<T extends Record<string, unknown>>(o: T): T {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(o)) out[k] = typeof v === 'string' && v.trim() === '' ? null : v
  return out as T
}
