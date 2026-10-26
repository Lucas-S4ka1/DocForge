/**
 * "System-Fenster": Blueprint-Panel mit Registriermarken ("+") und optionalem
 * Header im Stil "[ TAG ] Titel".
 */
import type { CSSProperties, ReactNode } from 'react'

export function Corners() {
  return (
    <>
      <i className="corner tl" />
      <i className="corner tr" />
      <i className="corner bl" />
      <i className="corner br" />
    </>
  )
}

interface PanelProps {
  tag?: string
  title?: ReactNode
  /** Inhalt rechts im Header (z. B. Link "Archiv öffnen →"). */
  aside?: ReactNode
  /** Hervorgehobener Rahmen mit Glow (aktive Kachel, About-Panel). */
  highlight?: boolean
  className?: string
  style?: CSSProperties
  children?: ReactNode
}

export function Panel({ tag, title, aside, highlight, className = '', style, children }: PanelProps) {
  return (
    <section
      className={`blueprint animate-panel-in flex flex-col gap-4 p-[18px] ${
        highlight ? 'border-accent-500 shadow-glow' : 'shadow-inner-panel'
      } ${className}`}
      style={style}
    >
      <Corners />
      {(tag || title || aside) && <PanelHeader tag={tag} title={title} aside={aside} />}
      {children}
    </section>
  )
}

export function PanelHeader({ tag, title, aside }: { tag?: string; title?: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 font-heading text-[13px] font-semibold uppercase leading-none tracking-system">
      {tag && <span className="text-accent-400">[ {tag} ]</span>}
      {title && <span className="text-accent-100">{title}</span>}
      {aside && <span className="ml-auto tracking-[0.08em] text-accent-400">{aside}</span>}
    </div>
  )
}

/** Platzhalter für Bereiche, die in späteren Phasen gefüllt werden. */
export function EmptyState({ title, hint, children }: { title?: string; hint?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 border border-dashed border-line p-6 text-center">
      {title && <span className="sys-label text-accent-300">{title}</span>}
      {hint && <p className="m-0 max-w-sm text-[13px] text-accent-400">{hint}</p>}
      {children}
    </div>
  )
}
