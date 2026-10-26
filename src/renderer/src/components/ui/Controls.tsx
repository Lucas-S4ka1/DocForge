/**
 * Formular-Bausteine im Design-Stil: Toggle, Segment-Auswahl, Slider, Fortschrittsbalken.
 */
import type { ReactNode } from 'react'

/** Schalter wie in den Screens: kleines Rechteck, das nach rechts springt. */
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange(v: boolean): void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-[18px] w-[34px] flex-none border transition-colors ${
        checked ? 'border-accent-500 bg-accent-600/70' : 'border-line bg-transparent'
      }`}
    >
      <span
        className={`absolute top-[3px] h-[10px] w-[10px] transition-all ${
          checked ? 'left-[19px] bg-accent-100 shadow-glow-dot' : 'left-[3px] bg-accent-600'
        }`}
      />
    </button>
  )
}

/** Zeile "Titel + Hinweis + Schalter" aus dem Settings-Screen. */
export function ToggleRow({
  title,
  hint,
  checked,
  onChange,
  disabled
}: {
  title: string
  hint?: string
  checked: boolean
  onChange(v: boolean): void
  disabled?: boolean
}) {
  return (
    <div className={`flex items-center gap-4 ${disabled ? 'opacity-40' : ''}`}>
      <div className="flex flex-col">
        <span className="text-[14px] text-accent-100">{title}</span>
        {hint && <span className="text-[12px] text-accent-400">{hint}</span>}
      </div>
      <div className="ml-auto">
        <Toggle checked={checked} onChange={disabled ? () => undefined : onChange} label={title} />
      </div>
    </div>
  )
}

export interface SegmentOption<T extends string> {
  value: T
  label: ReactNode
}

/** Segment-Auswahl (z. B. Sprache, Ränder, Backup-Intervall). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className = ''
}: {
  value: T
  options: SegmentOption<T>[]
  onChange(v: T): void
  ariaLabel: string
  className?: string
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={`flex border border-line ${className}`}>
      {options.map((o, i) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`flex-1 px-3 py-[9px] text-[13px] transition-colors ${i > 0 ? 'border-l border-line' : ''} ${
              on ? 'bg-accent-600/80 text-accent-100' : 'text-accent-200 hover:bg-accent-100/5'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** Slider mit leuchtender Spur und eckigem Griff. */
export function Slider({
  label,
  value,
  min = 0,
  max = 100,
  display,
  onChange
}: {
  label: string
  value: number
  min?: number
  max?: number
  display?: string
  onChange(v: number): void
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <label className="flex flex-col gap-2">
      <span className="flex items-end text-[14px] text-accent-100">
        {label}
        <span className="ml-auto font-mono text-[11px] text-accent-300">{display ?? value}</span>
      </span>
      <span className="relative block h-4">
        <span className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 bg-accent-500/20" />
        <span
          className="absolute left-0 top-1/2 h-[2px] -translate-y-1/2 bg-accent-400 shadow-glow-dot"
          style={{ width: `${pct}%` }}
        />
        <span
          className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 border border-accent-200 bg-ground"
          style={{ left: `${pct}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </span>
    </label>
  )
}

/** Quest-Fortschrittsbalken (4px, leuchtend). */
export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1 bg-accent-500/20">
      <div className="h-full bg-accent-400 shadow-glow-dot" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  )
}

/** Feldbeschriftung über einem Eingabeelement. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[12px] text-accent-300">{label}</span>
      {children}
    </div>
  )
}
