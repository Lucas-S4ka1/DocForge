/**
 * Branding-Block: "Version X.X.X" (aus package.json via app.getVersion())
 * und direkt darunter "produced by P.J. Works". Klein, gedämpftes Blau, leichter Glow.
 */
import { useTranslation } from 'react-i18next'
import { useApp } from '@/store/app'

export function Branding({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const { t } = useTranslation()
  const version = useApp((s) => s.info?.version ?? '…')
  const lg = size === 'lg'
  return (
    <div className="flex flex-col items-center gap-[3px] text-center">
      <span
        className={`text-glow-soft font-heading font-semibold uppercase text-accent-400 ${
          lg ? 'text-[14px] tracking-[0.16em]' : 'text-[10px] leading-[1.2] tracking-[0.1em]'
        }`}
      >
        {t('brand.version', { version })}
      </span>
      <span className={`text-glow-soft font-body text-accent-500 ${lg ? 'text-[13px]' : 'text-[9.5px] leading-[1.25]'}`}>
        {t('brand.producedBy')}
      </span>
    </div>
  )
}
