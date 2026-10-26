/**
 * Großer Screen-Kopf aus Hub/Archiv/Settings: Systemzeile + Titel in Versalien.
 */
import type { ReactNode } from 'react'

export function ScreenHeader({ system, title, aside }: { system: string; title: string; aside?: ReactNode }) {
  return (
    <header className="flex items-end gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="sys-label tracking-[0.16em] text-accent-400">{system}</span>
        <h1 className="text-glow m-0 text-[40px] uppercase tracking-[0.02em] text-accent-100">{title}</h1>
      </div>
      {aside && <div className="ml-auto flex items-center gap-2.5">{aside}</div>}
    </header>
  )
}

/** Badge "■ LOKALER SPEICHER · OFFLINE". */
export function LocalStorageBadge({ label, large }: { label: string; large?: boolean }) {
  return (
    <span
      className={`flex items-center gap-2 border border-line font-heading font-semibold uppercase leading-none tracking-label text-accent-300 ${
        large ? 'px-4 py-3 text-[12px]' : 'px-3 py-[7px] text-[11px]'
      }`}
    >
      <span className="h-1.5 w-1.5 bg-accent-400 shadow-glow-dot" />
      {label}
    </span>
  )
}
