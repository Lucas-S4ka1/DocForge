/** Einfaches Dropdown-Menü (für Filter wie Status/Profil/Tags). */
import { useEffect, useRef, useState, type ReactNode } from 'react'

export function Dropdown({
  label,
  active,
  children,
  width = 220,
  align = 'left'
}: {
  label: ReactNode
  active?: boolean
  children: ReactNode
  width?: number
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`border px-3 py-[7px] text-[12px] transition-colors ${
          active ? 'border-accent-400 text-accent-100 shadow-glow-sm' : 'border-line text-accent-200 hover:border-accent-400'
        }`}
      >
        {label}
      </button>
      {open && (
        <div
          className={`animate-panel-in absolute ${align === 'right' ? 'right-0' : 'left-0'} top-full z-40 mt-1 flex max-h-80 flex-col overflow-y-auto border border-accent-400 bg-ground py-1 shadow-glow`}
          style={{ width }}
          onClick={(e) => (e.target as HTMLElement).closest('[data-close]') && setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  )
}

export function DropdownItem({ checked, onClick, children, close }: { checked?: boolean; onClick(): void; children: ReactNode; close?: boolean }) {
  return (
    <button
      type="button"
      data-close={close ? '' : undefined}
      onClick={onClick}
      className="flex items-center gap-2.5 px-3 py-2 text-left text-[13px] text-accent-100 hover:bg-accent-500/15"
    >
      {checked !== undefined && (
        <span className={`h-3 w-3 flex-none border ${checked ? 'border-accent-300 bg-accent-400 shadow-glow-dot' : 'border-accent-500'}`} />
      )}
      {children}
    </button>
  )
}
