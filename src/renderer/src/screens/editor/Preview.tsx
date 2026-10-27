/**
 * A4-Vorschau in der Mitte (zoombar). Zeigt ungefähre Seitenumbrüche als gestrichelte Linie.
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DocumentView, pageMargins } from '@/documents/DocumentView'
import { useEditor } from '@/store/editor'
import { useApp } from '@/store/app'

const PX_PER_MM = 96 / 25.4

export function Preview() {
  const { t } = useTranslation()
  const content = useEditor((s) => s.content)!
  const zoom = useEditor((s) => s.zoom)
  const setZoom = useEditor((s) => s.setZoom)
  const lang = useApp((s) => s.settings.language)
  const ref = useRef<HTMLDivElement>(null)
  const [heightMm, setHeightMm] = useState(297)

  // Höhe des gerenderten Dokuments messen → Seitenumbrüche berechnen
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setHeightMm(el.offsetHeight / PX_PER_MM))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const m = pageMargins(content)
  const perPage = 297 - m.top - m.bottom
  const pages = Math.max(1, Math.ceil((heightMm - m.top - m.bottom - 0.5) / perPage))

  return (
    <div
      className="flex min-h-0 flex-1 justify-center overflow-auto px-6 pb-4 pt-[26px]"
      onWheel={(e) => {
        if (e.ctrlKey) {
          e.preventDefault()
          setZoom(zoom - e.deltaY * 0.001)
        }
      }}
    >
      <div style={{ zoom }} className="h-fit">
        <div ref={ref} className="relative shadow-paper">
          <DocumentView content={content} mode="preview" lang={lang} />
          {Array.from({ length: pages - 1 }).map((_, i) => (
            <div key={i} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-[#9aa6b5]" style={{ top: `${m.top + perPage * (i + 1)}mm` }}>
              <span className="absolute right-1 top-0.5 bg-white px-1 font-mono text-[9px] text-[#7a8594]">
                {t('editor.page', { n: i + 2 })} ↓
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
