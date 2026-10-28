/**
 * Vorlagen-Auswahl mit Live-Miniaturen des echten Inhalts (Design-Reiter und Import-Dialog).
 */
import { useTranslation } from 'react-i18next'
import { templatesByType, type DocContent } from '@shared/document'
import type { DocumentType } from '@shared/models'
import { DocumentView } from './DocumentView'

export function TemplatePicker({
  type,
  content,
  lang,
  value,
  onChange,
  columns = 3
}: {
  type: DocumentType
  content: DocContent
  lang: 'de' | 'en'
  value: string
  onChange(template: string): void
  columns?: number
}) {
  const { t } = useTranslation()
  return (
    <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {templatesByType[type].map((tpl) => {
        const on = value === tpl
        return (
          <button key={tpl} type="button" aria-pressed={on} onClick={() => onChange(tpl)} className="flex flex-col items-center gap-1.5">
            <div
              className={`relative h-[110px] w-[78px] overflow-hidden bg-white ${on ? 'outline outline-2 outline-offset-2 outline-accent-300 shadow-glow' : 'opacity-80 hover:opacity-100'}`}
            >
              <div style={{ zoom: 0.0975 }} className="pointer-events-none">
                <DocumentView content={{ ...content, style: { ...content.style, template: tpl } } as DocContent} mode="thumb" lang={lang} />
              </div>
            </div>
            <span className={`text-[11.5px] ${on ? 'text-accent-100' : 'text-accent-300'}`}>{t(`templates.${tpl}`)}</span>
          </button>
        )
      })}
    </div>
  )
}
