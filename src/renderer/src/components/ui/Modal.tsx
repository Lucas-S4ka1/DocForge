/**
 * Modales System-Fenster + Bestätigungsdialog.
 */
import { useEffect, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Corners } from './Panel'

export function Modal({
  tag,
  title,
  onClose,
  children,
  footer,
  width = 520
}: {
  tag: string
  title: string
  onClose(): void
  children: ReactNode
  footer?: ReactNode
  width?: number
}) {
  const box = useRef<HTMLDivElement>(null)

  // Fokus in den Dialog holen und beim Schließen zurückgeben (Tastaturbedienung)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    if (box.current && !box.current.contains(document.activeElement)) box.current.focus()
    return () => previous?.focus?.()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      // Tab-Fokus im Dialog halten
      if (e.key === 'Tab' && box.current) {
        const items = box.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea, select, [tabindex]:not([tabindex="-1"])')
        if (!items.length) return
        const first = items[0]
        const last = items[items.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-void/75 p-6 backdrop-blur-[2px]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={box}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        className="blueprint animate-panel-in flex max-h-full flex-col border-accent-400 bg-ground shadow-glow outline-none"
        style={{ width }}
      >
        <Corners />
        <div className="flex items-center gap-2.5 border-b border-line px-5 py-4 font-heading text-[13px] font-semibold uppercase leading-none tracking-system">
          <span className="text-accent-400">[ {tag} ]</span>
          <span>{title}</span>
        </div>
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  )
}

export function ConfirmDialog({
  title,
  text,
  confirmLabel,
  danger,
  onConfirm,
  onCancel
}: {
  title: string
  text: string
  confirmLabel: string
  danger?: boolean
  onConfirm(): void
  onCancel(): void
}) {
  const { t } = useTranslation()
  return (
    <Modal
      tag="SYSTEM"
      title={title}
      onClose={onCancel}
      width={440}
      footer={
        <>
          <button type="button" className="btn" onClick={onCancel}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            autoFocus
            className={`btn ${danger ? 'border-danger/70 text-danger hover:bg-danger/10' : 'btn-primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="m-0 whitespace-pre-line text-[14px] text-accent-200">{text}</p>
    </Modal>
  )
}
