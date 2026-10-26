/**
 * Schmale Kopfzeile (58px) für Editor und Kamera-Studio.
 */
import type { ReactNode } from 'react'

export function TopBar({ children }: { children: ReactNode }) {
  return (
    <header className="flex h-header flex-none items-center gap-3.5 border-b border-line bg-ground/80 px-5">
      {children}
    </header>
  )
}

/** Abschnittsüberschrift in Seitenleisten: "[ STRUKTUR ]". */
export function AsideLabel({ children }: { children: ReactNode }) {
  return <div className="sys-label text-accent-400">{children}</div>
}
