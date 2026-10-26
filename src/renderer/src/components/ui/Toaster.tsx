/** Systemmeldungen unten rechts. */
import { useToasts } from '@/store/toast'

const kindStyle = {
  info: 'border-accent-400 text-accent-100',
  success: 'border-accent-300 text-accent-100',
  error: 'border-danger/70 text-danger'
} as const

export function Toaster() {
  const toasts = useToasts((s) => s.toasts)
  const dismiss = useToasts((s) => s.dismiss)
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[120] flex w-[380px] flex-col gap-2" aria-live="polite">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismiss(t.id)}
          className={`animate-panel-in pointer-events-auto flex items-start gap-2 border bg-ground/95 px-4 py-3 text-left font-mono text-[12.5px] shadow-glow-sm ${kindStyle[t.kind]}`}
        >
          <span className="flex-none text-accent-400">[ {t.kind === 'error' ? 'ERROR' : 'SYSTEM'} ]</span>
          <span>{t.text}</span>
        </button>
      ))}
    </div>
  )
}
