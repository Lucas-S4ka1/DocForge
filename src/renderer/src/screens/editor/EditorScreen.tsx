/**
 * Dokument-Editor: Struktur links, A4-Vorschau Mitte (zoombar), Inhalt/Design rechts,
 * Befehlsleiste unten (KI-Anbindung folgt). Export als PDF und DOCX.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { documentTypes } from '@shared/models'
import { useEditor } from '@/store/editor'
import { useApp } from '@/store/app'
import { db, useQuery } from '@/store/db'
import { toast } from '@/store/toast'
import { formatDateTime } from '@/lib/format'
import { openInEditor } from '@/lib/newDocument'
import { requestCreate } from '@/lib/requestCreate'
import { Corners, EmptyState, Panel } from '@/components/ui/Panel'
import { TopBar } from '@/components/layout/TopBar'
import { useAction } from '../archive/common'
import { StructurePanel } from './StructurePanel'
import { Preview } from './Preview'
import { ContentPanel } from './ContentPanel'
import { DesignPanel } from './DesignPanel'

export function EditorScreen() {
  const doc = useEditor((s) => s.doc)
  const content = useEditor((s) => s.content)
  if (!doc || !content) return <EditorStart />
  return <EditorWorkspace />
}

/** Ohne geöffnetes Dokument: neues anlegen oder zuletzt bearbeitetes öffnen. */
function EditorStart() {
  const { t } = useTranslation()
  const lang = useApp((s) => s.settings.language)
  const profileId = useApp((s) => s.settings.activeProfileId)
  const recent = useQuery(() => db.documents.list({ profileId, limit: 12 }), [profileId]).data ?? []
  return (
    <>
      <TopBar>
        <span className="sys-label text-accent-400">{t('editor.crumb')}</span>
        <span className="font-heading text-[18px] font-semibold leading-none text-accent-300">{t('editor.untitled')}</span>
      </TopBar>
      <main className="grid min-h-0 flex-1 grid-cols-[360px_minmax(0,1fr)] gap-5 px-[30px] py-[26px]">
        <Panel tag="NEU" title={t('editor.createNew')}>
          <div className="flex flex-col gap-2">
            {documentTypes.map((type) => (
              <button key={type} type="button" className="btn justify-start py-3 text-[15px]" onClick={() => void requestCreate(type)}>
                + {t(`docType.${type}`)}
              </button>
            ))}
          </div>
        </Panel>
        <Panel tag="LOG" title={t('hub.recent')}>
          {recent.length === 0 ? (
            <EmptyState hint={t('hub.recentEmpty')} />
          ) : (
            <div className="flex min-h-0 flex-col overflow-y-auto">
              {recent.map((d) => (
                <button key={d.id} type="button" onClick={() => void openInEditor(d.id)} className="flex items-center gap-4 border-b border-line px-2 py-3 text-left hover:bg-accent-100/[0.04]">
                  <span className="w-28 flex-none font-heading text-[11px] font-semibold uppercase tracking-label text-accent-400">{t(`docType.${d.type}`)}</span>
                  <span className="flex-1 truncate text-accent-100">{d.title}</span>
                  <span className="text-[12px] text-accent-400">{formatDateTime(d.updatedAt, lang)}</span>
                </button>
              ))}
            </div>
          )}
        </Panel>
      </main>
    </>
  )
}

function EditorWorkspace() {
  const { t } = useTranslation()
  const lang = useApp((s) => s.settings.language)
  const doc = useEditor((s) => s.doc)!
  const { zoom, setZoom, panel, setPanel, saving, dirty, savedAt, rename, flush } = useEditor()
  const run = useAction()
  const [title, setTitle] = useState(doc.title)
  const [exporting, setExporting] = useState<'pdf' | 'docx' | null>(null)
  const company = useQuery(() => (doc.applicationId ? db.applications.getRow(doc.applicationId).then((a) => a.companyName) : Promise.resolve(null)), [doc.applicationId]).data

  useEffect(() => setTitle(doc.title), [doc.title])
  // Beim Verlassen des Editors sofort speichern
  useEffect(() => () => void flush(), [flush])

  const doExport = (kind: 'pdf' | 'docx') =>
    run(async () => {
      setExporting(kind)
      try {
        await flush()
        const path = kind === 'pdf' ? await window.docforge.exporter.pdf(doc.id) : await window.docforge.exporter.docx(doc.id)
        if (path) toast.success(t('editor.exported', { file: path.split(/[\\/]/).pop() }))
      } finally {
        setExporting(null)
      }
    })

  // Tastenkürzel: Strg/Cmd + / − / 0 für Zoom, Strg+S speichert sofort
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      if (e.key === 's') {
        e.preventDefault()
        void flush()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flush])

  return (
    <>
      <TopBar>
        <span className="sys-label flex-none text-accent-400">{t('editor.crumb')}</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title !== doc.title && void rename(title)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="min-w-0 max-w-[340px] flex-1 border-b border-transparent bg-transparent font-heading text-[18px] font-semibold leading-none text-accent-100 hover:border-line focus:border-accent-400"
          aria-label={t('fields.title')}
        />
        <span className="tag flex-none bg-accent-500/20 text-accent-200">
          {t(`docShort.${doc.type}`)}
          {company ? ` · ${company}` : ''}
        </span>
        <span className="flex-none text-[12px] text-accent-400">
          {saving || dirty ? t('editor.saving') : t('editor.savedAt', { time: savedAt ? formatDateTime(savedAt, lang).split(' · ').pop() : '' })}
        </span>
        <div className="ml-auto flex flex-none items-center gap-2">
          <div className="flex items-center border border-line text-[13px] text-accent-200">
            <button type="button" className="px-2.5 py-1.5 hover:bg-accent-100/5" onClick={() => setZoom(zoom - 0.1)} aria-label="Zoom −">−</button>
            <button type="button" className="w-14 border-x border-line py-1.5 hover:bg-accent-100/5" onClick={() => setZoom(0.85)} title="Reset">
              {Math.round(zoom * 100)}%
            </button>
            <button type="button" className="px-2.5 py-1.5 hover:bg-accent-100/5" onClick={() => setZoom(zoom + 0.1)} aria-label="Zoom +">+</button>
          </div>
          <button type="button" className={`btn ${panel === 'design' ? 'border-accent-400' : ''}`} onClick={() => setPanel(panel === 'design' ? 'content' : 'design')}>
            {t('editor.templates')}
          </button>
          <button type="button" className="btn" disabled={!!exporting} onClick={() => doExport('docx')}>
            {exporting === 'docx' ? '…' : t('editor.exportDocx')}
          </button>
          <button type="button" className="btn btn-primary blueprint" disabled={!!exporting} onClick={() => doExport('pdf')}>
            <Corners />
            {exporting === 'pdf' ? '…' : t('editor.exportPdf')}
          </button>
        </div>
      </TopBar>

      <div className="flex min-h-0 flex-1">
        <StructurePanel />

        <div className="flex min-w-0 flex-1 flex-col">
          <Preview />
          {/* Prompt-Befehlsleiste (Claude-Anbindung folgt) */}
          <div className="flex-none px-[22px] pb-[18px] pt-2">
            <div className="blueprint flex h-[52px] items-center gap-3 border-accent-400 bg-accent-900/70 pl-4 pr-2 shadow-glow">
              <Corners />
              <span className="font-mono text-[16px] font-medium text-accent-300">&gt;</span>
              <span className="flex-1 font-mono text-[14px] text-accent-500">
                {t('editor.commandPlaceholder')}
                <span className="animate-caret ml-0.5 inline-block h-4 w-2 bg-accent-300 align-[-3px]" />
              </span>
              <span className="text-[12px] text-accent-500">{t('editor.aiSoon')}</span>
              <button type="button" className="btn btn-primary" disabled>
                {t('editor.run')} ⏎
              </button>
            </div>
          </div>
        </div>

        <aside className="flex w-[300px] flex-none flex-col border-l border-line">
          <div className="flex flex-none border-b border-line">
            {(['content', 'design'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPanel(p)}
                className={`-mb-px flex-1 border-b-2 py-3 font-heading text-[12px] font-semibold uppercase tracking-system ${
                  panel === p ? 'border-accent-400 text-accent-100' : 'border-transparent text-accent-400 hover:text-accent-200'
                }`}
              >
                [ {t(`editor.panel.${p}`)} ]
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{panel === 'content' ? <ContentPanel /> : <DesignPanel />}</div>
        </aside>
      </div>
    </>
  )
}


