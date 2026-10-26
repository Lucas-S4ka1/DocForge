/**
 * Inhalt des About-Panels (wird im Settings-Screen und im About-Dialog verwendet).
 */
import { useTranslation } from 'react-i18next'
import { Corners } from '../ui/Panel'
import { Logo } from './Logo'
import { Branding } from './Branding'

export function AboutContent({ onClose }: { onClose?: () => void }) {
  const { t } = useTranslation()
  return (
    <section className="blueprint animate-panel-in flex flex-col items-center gap-5 border-accent-400 bg-ground px-7 pb-7 pt-6 shadow-glow">
      <Corners />
      <div className="flex w-full items-center">
        <span className="sys-label text-accent-400">{t('settings.about')}</span>
        {onClose && (
          <button type="button" onClick={onClose} className="btn btn-ghost ml-auto px-2 py-1 text-[12px]">
            {t('common.close')}
          </button>
        )}
      </div>
      <Logo size={92} />
      <h2 className="text-glow m-0 text-[40px] uppercase tracking-[0.16em] text-accent-100">DocForge</h2>
      <p className="m-0 max-w-[260px] text-center text-[14px] text-accent-200">{t('brand.tagline')}</p>
      <div className="h-px w-full bg-line" />
      <Branding size="lg" />
      <button type="button" className="btn" disabled title={t('common.comingInPhase', { phase: 7 })}>
        {t('settings.checkUpdates')}
      </button>
    </section>
  )
}
