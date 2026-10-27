/**
 * Review eines KI-Vorschlags (Design 1c):
 * - ReviewView (Mitte): Änderungen als Rot/Grün-Diff auf Papier bzw. Vorschau des Ergebnisses
 * - ReviewPanel (rechts): Alle übernehmen/verwerfen, einzelne Änderungen an/aus, Versionsverlauf
 * - PostingPanel (links): Stellenanzeige mit Treffern und fehlenden Anforderungen
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { applyChanges, getAt, parsePointer, toReadable, wordDiff, type AiChange } from '@shared/ai'
import type { CvContent, DocContent } from '@shared/document'
import { DocumentView } from '@/documents/DocumentView'
import { useAi, type Proposal } from '@/store/ai'
import { useEditor } from '@/store/editor'
import { useApp } from '@/store/app'
import { toast } from '@/store/toast'
import { Corners } from '@/components/ui/Panel'
import { AsideLabel } from '@/components/layout/TopBar'
import { HistoryList } from './HistoryPanel'

/** Menschlich lesbarer Ort einer Änderung, z. B. "Berufserfahrung › Eintrag 1 › Beschreibung". */
function describePath(content: DocContent, path: string, t: (k: string, o?: Record<string, unknown>) => string): string {
  const keys = (() => {
    try {
      return parsePointer(path)
    } catch {
      return []
    }
  })()
  const out: string[] = []
  if (content.kind === 'cv' && keys[0] === 'sections') {
    const sec = (content as CvContent).sections[Number(keys[1])]
    if (sec) out.push(sec.title)
    if (keys[2] === 'entries') out.push(t('ai.where.entry', { n: Number(keys[3]) + 1 || '+' }))
    if (keys[2] === 'items') out.push(t('ai.where.item', { n: Number(keys[3]) + 1 || '+' }))
    if (keys[4]) out.push(t(`ai.field.${keys[4]}`, { defaultValue: keys[4] }))
    else if (keys[2] && !['entries', 'items'].includes(keys[2])) out.push(t(`ai.field.${keys[2]}`, { defaultValue: keys[2] }))
  } else {
    for (const k of keys) if (!/^\d+$/.test(k)) out.push(t(`ai.field.${k}`, { defaultValue: k }))
  }
  return out.join(' › ')
}

function DiffText({ before, after }: { before: string; after: string }) {
  const parts = useMemo(() => wordDiff(before, after), [before, after])
  return (
    <p className="m-0 whitespace-pre-wrap text-[10.5pt] leading-relaxed text-[#232427]">
      {parts.map((p, i) =>
        p.type === 'same' ? (
          <span key={i}>{p.text}</span>
        ) : p.type === 'del' ? (
          <del key={i} className="bg-[#fde2e2] text-[#b42318] decoration-[#b42318]">
            {p.text}
          </del>
        ) : (
          <ins key={i} className="bg-[#dcfce7] text-[#166534] no-underline">
            {p.text}
          </ins>
        )
      )}
    </p>
  )
}

function changeTexts(content: DocContent, c: AiChange): { before: string; after: string } {
  const before = c.action === 'insert' ? '' : toReadable(getAt(content, c.path))
  let after = ''
  if (c.action !== 'remove') {
    try {
      after = toReadable(JSON.parse(c.new_value_json))
    } catch {
      after = ''
    }
  }
  return { before, after }
}

export function ReviewView({ proposal }: { proposal: Proposal }) {
  const { t } = useTranslation()
  const content = useEditor((s) => s.content)!
  const zoom = useEditor((s) => s.zoom)
  const lang = useApp((s) => s.settings.language)
  const { reviewView, setReviewView, toggle } = useAi()
  const preview = useMemo(
    () => applyChanges(content, proposal.changes.filter((_, i) => proposal.accepted[i])),
    [content, proposal]
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-none justify-center gap-1 pt-4">
        {(['diff', 'preview'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setReviewView(v)}
            className={`border px-3 py-1 text-[12px] ${reviewView === v ? 'border-accent-400 bg-accent-500/15 text-accent-100' : 'border-line text-accent-300'}`}
          >
            {t(`ai.view.${v}`)}
          </button>
        ))}
      </div>
      <div className="flex min-h-0 flex-1 justify-center overflow-auto px-6 pb-4 pt-4">
        {reviewView === 'preview' ? (
          <div style={{ zoom }} className="h-fit shadow-paper">
            <DocumentView content={preview} mode="preview" lang={lang} />
          </div>
        ) : (
          <div className="h-fit w-[680px] max-w-full bg-white px-12 py-10 text-[#232427] shadow-paper">
            <p className="m-0 mb-6 font-mono text-[11px] uppercase tracking-[0.12em] text-[#6b6e75]">
              &gt; {proposal.command}
            </p>
            {proposal.summary && <p className="m-0 mb-6 text-[10.5pt] italic text-[#4b4e55]">{proposal.summary}</p>}
            {proposal.changes.length === 0 && <p className="m-0 text-[10.5pt] text-[#6b6e75]">{t('ai.noChanges')}</p>}
            {proposal.changes.map((c, i) => {
              const { before, after } = changeTexts(content, c)
              const on = proposal.accepted[i]
              return (
                <div key={i} className={`mb-6 border-l-2 pl-4 transition-opacity ${on ? 'border-[#749dc4]' : 'border-[#d9dbe0] opacity-40'}`}>
                  <div className="mb-1.5 flex items-baseline gap-2">
                    <span className="text-[9pt] font-semibold uppercase tracking-[0.1em] text-[#416180]">{c.label}</span>
                    <span className="text-[8.5pt] text-[#9a9da5]">{describePath(content, c.path, t)}</span>
                    <button type="button" className="ml-auto text-[8.5pt] text-[#416180] hover:underline" onClick={() => toggle(i)}>
                      {on ? t('ai.skip') : t('ai.include')}
                    </button>
                  </div>
                  <DiffText before={before} after={after} />
                </div>
              )
            })}
            {proposal.invalidCount > 0 && <p className="m-0 text-[9pt] text-[#9a9da5]">{t('ai.invalid', { count: proposal.invalidCount })}</p>}
          </div>
        )}
      </div>
    </div>
  )
}

export function ReviewPanel({ proposal }: { proposal: Proposal }) {
  const { t } = useTranslation()
  const content = useEditor((s) => s.content)!
  const { toggle, apply, discard } = useAi()
  const selected = proposal.accepted.filter(Boolean).length

  const doApply = async (only: boolean) => {
    const n = await apply(only)
    toast.success(n ? t('ai.applied', { count: n }) : t('ai.discarded'))
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <AsideLabel>
        [ REVIEW ] {t('ai.changes', { count: proposal.changes.length })}
      </AsideLabel>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn btn-primary blueprint" disabled={!proposal.changes.length} onClick={() => void doApply(false)}>
          <Corners />
          {t('ai.acceptAll')}
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            discard()
            toast.info(t('ai.discarded'))
          }}
        >
          {t('ai.rejectAll')}
        </button>
      </div>
      <div className="flex flex-col">
        {proposal.changes.map((c, i) => {
          const on = proposal.accepted[i]
          const sign = c.action === 'insert' ? '+' : c.action === 'remove' ? '−' : '±'
          return (
            <div key={i} className={`flex items-center gap-2.5 border-b border-line py-2.5 text-[13.5px] ${on ? 'text-accent-100' : 'text-accent-500 line-through'}`}>
              <span className="w-3 flex-none text-accent-400">{sign}</span>
              <span className="min-w-0 flex-1" title={describePath(content, c.path, t)}>
                {c.label}
              </span>
              <button type="button" aria-label={t('ai.include')} onClick={() => toggle(i, true)} className={`px-1 ${on ? 'text-accent-200' : 'text-accent-600 hover:text-accent-300'}`}>
                ✓
              </button>
              <button type="button" aria-label={t('ai.skip')} onClick={() => toggle(i, false)} className={`px-1 ${!on ? 'text-danger' : 'text-accent-600 hover:text-danger'}`}>
                ✕
              </button>
            </div>
          )
        })}
      </div>
      {proposal.changes.length > 0 && selected !== proposal.changes.length && (
        <button type="button" className="btn" disabled={!selected} onClick={() => void doApply(true)}>
          {t('ai.applySelected', { n: selected })}
        </button>
      )}
      {(proposal.usedFallback || proposal.model) && (
        <span className="font-mono text-[11px] text-accent-500">
          {proposal.model}
          {proposal.usedFallback ? ` · ${t('ai.fallback')}` : ''}
        </span>
      )}

      <AsideLabel>[ HISTORY ] {t('ai.versions')}</AsideLabel>
      <HistoryList pending={proposal} />
    </div>
  )
}

export function PostingPanel({ proposal, posting }: { proposal: Proposal; posting: string }) {
  const { t } = useTranslation()
  const matched = proposal.matched_keywords
  const missing = proposal.missing_keywords
  const total = matched.length + missing.length

  // Treffer im Anzeigentext unterstreichen
  const parts = useMemo(() => {
    const keys = [...matched].filter((k) => k.trim().length > 1).sort((a, b) => b.length - a.length)
    if (!keys.length) return [{ text: posting, hit: false }]
    const esc = keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    const re = new RegExp(`(${esc.join('|')})`, 'gi')
    return posting.split(re).map((text) => ({ text, hit: keys.some((k) => k.toLowerCase() === text.toLowerCase()) }))
  }, [posting, matched])

  return (
    <aside className="flex w-[290px] flex-none flex-col gap-3 border-r border-line px-4 py-[18px]">
      <div className="flex items-center">
        <span className="sys-label text-accent-400">[ INPUT ] {t('ai.posting')}</span>
        {total > 0 && (
          <span className="sys-label ml-auto text-accent-200">
            {matched.length} / {total} {t('ai.match')}
          </span>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto border border-line p-4 text-[13.5px] leading-[1.6] text-accent-100">
        <p className="m-0 whitespace-pre-wrap">
          {parts.map((p, i) =>
            p.hit ? (
              <span key={i} className="bg-accent-500/20 underline decoration-accent-300 underline-offset-2">
                {p.text}
              </span>
            ) : (
              <span key={i}>{p.text}</span>
            )
          )}
        </p>
      </div>
      {missing.length > 0 && (
        <>
          <span className="sys-label text-accent-400">{t('ai.notInProfile')}</span>
          <div className="flex flex-wrap gap-1.5">
            {missing.map((m) => (
              <span key={m} className="border border-accent-500 px-2 py-[3px] text-[12px] text-accent-200">
                {m}
              </span>
            ))}
          </div>
          <span className="text-[11px] text-accent-500">{t('ai.notInvented')}</span>
        </>
      )}
    </aside>
  )
}
