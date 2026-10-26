/**
 * Tabelle im Archiv-Stil: Kopfzeile in Versalien, Zeilen mit Hover und
 * markierter Auswahl (linke Leuchtkante).
 */
import type { ReactNode } from 'react'

export interface Column<T> {
  key: string
  label: string
  /** CSS-Grid-Spaltenbreite, z. B. "1.2fr" */
  width: string
  render(row: T): ReactNode
}

export function DataTable<T extends { id: number }>({
  columns,
  rows,
  selectedId,
  onSelect,
  empty
}: {
  columns: Column<T>[]
  rows: T[]
  selectedId?: number | null
  onSelect(row: T): void
  empty: ReactNode
}) {
  const grid = { gridTemplateColumns: columns.map((c) => c.width).join(' ') }
  return (
    <div className="flex min-h-0 flex-1 flex-col border border-line">
      <div className="grid flex-none gap-3 border-b border-line px-3.5 py-3" style={grid}>
        {columns.map((c) => (
          <span key={c.key} className="truncate text-[11px] uppercase tracking-[0.08em] text-accent-400">
            {c.label}
          </span>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <div className="flex h-full p-4">{empty}</div>
        ) : (
          rows.map((r) => {
            const on = r.id === selectedId
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => onSelect(r)}
                className={`grid w-full items-center gap-3 border-b border-accent-100/[0.08] px-3.5 py-3 text-left text-[14px] transition-colors ${
                  on
                    ? 'bg-accent-500/15 shadow-[inset_2px_0_0_rgb(var(--accent-400))]'
                    : 'hover:bg-accent-100/[0.04]'
                }`}
                style={grid}
              >
                {columns.map((c) => (
                  <span key={c.key} className="min-w-0 truncate">
                    {c.render(r)}
                  </span>
                ))}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
