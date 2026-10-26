/**
 * Dokument-Editor: Struktur links, A4-Vorschau Mitte, Vorlage/Eigenschaften rechts,
 * Prompt-Befehlsleiste unten. Phase 1: Gerüst nach Design. Funktionen folgen in Phase 3/5.
 */
import { useTranslation } from 'react-i18next'
import { Corners, EmptyState } from '@/components/ui/Panel'
import { TopBar, AsideLabel } from '@/components/layout/TopBar'

export function EditorScreen() {
  const { t } = useTranslation()
  const later = t('common.comingInPhase', { phase: 3 })

  return (
    <>
      <TopBar>
        <span className="sys-label text-accent-400">{t('editor.crumb')}</span>
        <span className="font-heading text-[18px] font-semibold leading-none text-accent-300">{t('editor.untitled')}</span>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center border border-line text-[13px] text-accent-200 opacity-40">
            <span className="px-2.5 py-1.5">−</span>
            <span className="border-x border-line px-2.5 py-1.5">85%</span>
            <span className="px-2.5 py-1.5">+</span>
          </div>
          <button type="button" className="btn" disabled title={later}>{t('editor.templates')}</button>
          <button type="button" className="btn" disabled title={later}>{t('editor.exportDocx')}</button>
          <button type="button" className="btn btn-primary blueprint" disabled title={later}>
            <Corners />
            {t('editor.exportPdf')}
          </button>
        </div>
      </TopBar>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[260px] flex-none flex-col gap-3 border-r border-line px-4 py-[18px]">
          <AsideLabel>{t('editor.structure')}</AsideLabel>
          <EmptyState hint={later} />
          <button type="button" className="btn border-dashed text-accent-300" disabled>{t('editor.addSection')}</button>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 items-center justify-center p-8">
            <EmptyState title={t('editor.emptyTitle')} hint={t('editor.emptyHint')} />
          </div>

          {/* Prompt-Befehlsleiste (Phase 5) */}
          <div className="flex-none px-[22px] pb-[18px] pt-3.5">
            <div className="blueprint flex h-[52px] items-center gap-3 border-accent-400 bg-accent-900/70 pl-4 pr-2 shadow-glow">
              <Corners />
              <span className="font-mono text-[16px] font-medium text-accent-300">&gt;</span>
              <span className="flex-1 font-mono text-[14px] text-accent-500">
                {t('editor.commandPlaceholder')}
                <span className="animate-caret ml-0.5 inline-block h-4 w-2 bg-accent-300 align-[-3px]" />
              </span>
              <span className="text-[12px] text-accent-500">{t('common.comingInPhase', { phase: 5 })}</span>
              <button type="button" className="btn btn-primary" disabled>{t('editor.run')} ⏎</button>
            </div>
          </div>
        </div>

        <aside className="flex w-[292px] flex-none flex-col gap-[18px] border-l border-line px-4 py-[18px]">
          <AsideLabel>{t('editor.template')}</AsideLabel>
          <div className="grid grid-cols-3 gap-2.5 opacity-40">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[1/1.414] bg-paper/90 p-2">
                <span className="block h-1 w-3/5 bg-paper-ink/70" />
                <span className="mt-1 block h-px w-2/5 bg-accent-600" />
              </div>
            ))}
          </div>
          <AsideLabel>{t('editor.properties')}</AsideLabel>
          <EmptyState hint={later} />
        </aside>
      </div>
    </>
  )
}
