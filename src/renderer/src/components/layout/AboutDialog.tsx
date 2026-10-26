/**
 * "Über DocForge"-Fenster (Modal) – erreichbar über die Seitenleiste und das Menü.
 */
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '@/store/app'
import { AboutContent } from './AboutContent'

export function AboutDialog() {
  const { t } = useTranslation()
  const open = useApp((s) => s.aboutOpen)
  const setOpen = useApp((s) => s.setAboutOpen)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-void/75 backdrop-blur-[2px]"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label={t('about.title')}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-[420px]">
        <AboutContent onClose={() => setOpen(false)} />
      </div>
    </div>
  )
}
