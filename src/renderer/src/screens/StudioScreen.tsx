/**
 * Kamera-Studio. Phase 1: Gerüst nach Design. Kamera, Overlays, Segmentierung folgen in Phase 4.
 * Die Kamera wird NIE automatisch gestartet – erst nach Klick des Nutzers.
 */
import { useTranslation } from 'react-i18next'
import { Corners, EmptyState } from '@/components/ui/Panel'
import { TopBar, AsideLabel } from '@/components/layout/TopBar'

export function StudioScreen() {
  const { t } = useTranslation()
  const later = t('common.comingInPhase', { phase: 4 })

  return (
    <>
      <TopBar>
        <span className="font-heading text-[18px] font-semibold uppercase leading-none tracking-[0.06em] text-accent-100">
          {t('studio.title')}
        </span>
        <span className="ml-auto font-mono text-[12px] text-accent-400">{t('studio.processedLocally')}</span>
      </TopBar>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[240px] flex-none flex-col gap-[18px] border-r border-line px-4 py-[18px]">
          <AsideLabel>{t('studio.capture')}</AsideLabel>
          <AsideLabel>{t('studio.overlays')}</AsideLabel>
          <AsideLabel>{t('studio.crop')}</AsideLabel>
          <EmptyState hint={later} />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col p-5">
          <div className="blueprint relative flex flex-1 items-center justify-center bg-void/80">
            <Corners />
            <span className="absolute left-4 top-4 flex items-center gap-2 font-heading text-[12px] font-semibold uppercase tracking-label text-accent-500">
              <span className="h-2 w-2 border border-accent-500" />
              {t('studio.cameraOff')}
            </span>
            <div className="flex max-w-sm flex-col items-center gap-4 text-center">
              <p className="m-0 text-[13px] text-accent-400">{t('studio.cameraOffHint')}</p>
              <button type="button" className="btn btn-primary" disabled title={later}>{t('studio.startCamera')}</button>
            </div>
          </div>
        </div>

        <aside className="flex w-[272px] flex-none flex-col gap-[18px] border-l border-line px-4 py-[18px]">
          <AsideLabel>{t('studio.adjust')}</AsideLabel>
          <AsideLabel>{t('studio.background')}</AsideLabel>
          <EmptyState hint={later} />
        </aside>
      </div>
    </>
  )
}
