/**
 * Linke Spalte: Dokumentstruktur. Beim Lebenslauf sind die Abschnitte per Drag & Drop
 * sortierbar, ein-/ausblendbar und erweiterbar. Unten: Quest "Lebenslauf vollständig".
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cvChecklist, newSection, type CvContent, type DocContent, type SectionKind } from '@shared/document'
import { useEditor } from '@/store/editor'
import { useApp } from '@/store/app'
import { ProgressBar } from '@/components/ui/Controls'
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown'
import { AsideLabel } from '@/components/layout/TopBar'

const addableKinds: SectionKind[] = ['profile', 'experience', 'education', 'skills', 'languages', 'certificates', 'interests', 'custom']

/** Feste Teile für Nicht-Lebenslauf-Dokumente. */
const fixedParts: Record<Exclude<DocContent['kind'], 'cv'>, string[]> = {
  letter: ['sender', 'recipient', 'meta', 'body', 'closing'],
  cover: ['main'],
  free: ['main']
}

function Row({
  label,
  count,
  active,
  muted,
  onClick,
  handle,
  extra,
  dragProps
}: {
  label: string
  count?: number
  active: boolean
  muted?: boolean
  onClick(): void
  handle?: boolean
  extra?: React.ReactNode
  dragProps?: React.HTMLAttributes<HTMLDivElement> & { draggable?: boolean }
}) {
  return (
    <div
      {...dragProps}
      onClick={onClick}
      className={`group flex cursor-pointer items-center gap-2.5 border px-2.5 py-[9px] text-[14px] transition-colors ${
        active ? 'border-accent-400 bg-accent-500/15 text-accent-100 shadow-glow-sm' : 'border-line text-accent-100 hover:border-accent-500'
      } ${muted ? 'opacity-50' : ''}`}
    >
      {handle && <span className="cursor-grab text-[12px] tracking-[-1px] text-accent-500">⋮⋮</span>}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {extra}
      {count !== undefined && <span className="text-[12px] text-accent-400">{count}</span>}
    </div>
  )
}

export function StructurePanel() {
  const { t } = useTranslation()
  const lang = useApp((s) => s.settings.language)
  const content = useEditor((s) => s.content)!
  const selected = useEditor((s) => s.selected)
  const select = useEditor((s) => s.select)
  const edit = useEditor((s) => s.edit)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  if (content.kind !== 'cv') {
    return (
      <aside className="flex w-[260px] flex-none flex-col gap-3 border-r border-line px-4 py-[18px]">
        <AsideLabel>{t('editor.structure')}</AsideLabel>
        <div className="flex flex-col gap-1.5">
          {fixedParts[content.kind].map((part) => (
            <Row key={part} label={t(`editor.parts.${content.kind}.${part}`)} active={selected === part} onClick={() => select(part)} />
          ))}
        </div>
      </aside>
    )
  }

  const cv = content as CvContent
  const countOf = (s: CvContent['sections'][number]) =>
    s.entries.filter((e) => e.title || e.org).length + s.items.filter((i) => i.name).length + (s.text.trim() ? 1 : 0)

  const drop = () => {
    if (dragId !== null && dropIndex !== null) {
      edit((c) => {
        const secs = (c as CvContent).sections
        const from = secs.findIndex((s) => s.id === dragId)
        const [moved] = secs.splice(from, 1)
        secs.splice(dropIndex > from ? dropIndex - 1 : dropIndex, 0, moved)
      })
    }
    setDragId(null)
    setDropIndex(null)
  }

  const checks = cvChecklist(cv)
  const done = checks.filter((c) => c.done).length
  const missing = checks.filter((c) => !c.done).map((c) => t(`editor.checks.${c.key}`))

  return (
    <aside className="flex w-[260px] flex-none flex-col gap-3 border-r border-line px-4 py-[18px]">
      <AsideLabel>{t('editor.structure')}</AsideLabel>
      <div className="-mr-2 flex min-h-0 flex-col gap-1.5 overflow-y-auto pr-2" onDragOver={(e) => e.preventDefault()} onDrop={drop}>
        <Row label={t('editor.personal')} count={Object.values(cv.personal).filter(Boolean).length} active={selected === 'personal'} onClick={() => select('personal')} />
        {cv.sections.map((s, i) => (
          <div key={s.id}>
            {dropIndex === i && dragId && <div className="mb-1.5 h-[2px] bg-accent-400 shadow-glow-dot" />}
            <Row
              label={s.title}
              count={countOf(s)}
              handle
              muted={!s.visible || s.id === dragId}
              active={selected === s.id}
              onClick={() => select(s.id)}
              extra={
                <button
                  type="button"
                  title={s.visible ? t('editor.hide') : t('editor.show')}
                  onClick={(e) => {
                    e.stopPropagation()
                    edit((c) => {
                      const x = (c as CvContent).sections.find((y) => y.id === s.id)!
                      x.visible = !x.visible
                    })
                  }}
                  className="text-[11px] text-accent-500 opacity-0 hover:text-accent-200 group-hover:opacity-100"
                >
                  {s.visible ? '◉' : '○'}
                </button>
              }
              dragProps={{
                draggable: true,
                onDragStart: (e) => {
                  setDragId(s.id)
                  e.dataTransfer.effectAllowed = 'move'
                },
                onDragOver: (e) => {
                  e.preventDefault()
                  const r = e.currentTarget.getBoundingClientRect()
                  setDropIndex(e.clientY < r.top + r.height / 2 ? i : i + 1)
                },
                onDragEnd: () => {
                  setDragId(null)
                  setDropIndex(null)
                }
              }}
            />
          </div>
        ))}
        {dropIndex === cv.sections.length && dragId && <div className="h-[2px] bg-accent-400 shadow-glow-dot" />}
      </div>
      <Dropdown label={<span className="text-accent-300">{t('editor.addSection')}</span>} width={226}>
        {addableKinds.map((k) => (
          <DropdownItem
            key={k}
            close
            onClick={() => {
              const sec = newSection(k, lang)
              edit((c) => void (c as CvContent).sections.push(sec))
              select(sec.id)
            }}
          >
            {t(`editor.kinds.${k}`)}
          </DropdownItem>
        ))}
      </Dropdown>

      <div className="mt-auto flex flex-col gap-1.5 border-t border-line pt-3">
        <div className="flex text-[12px] text-accent-300">
          <span>[ QUEST ] {t('editor.questCv')}</span>
          <span className="ml-auto">
            {done}/{checks.length}
          </span>
        </div>
        <ProgressBar value={(done / checks.length) * 100} />
        <span className="text-[12px] text-accent-400">{missing.length ? `${t('editor.missing')}: ${missing.join(', ')}` : t('editor.complete')}</span>
      </div>
    </aside>
  )
}
