/**
 * Seitenleiste (88px) exakt nach Design: Logo, fünf Bereiche, Branding unten.
 */
import { useTranslation } from 'react-i18next'
import { useApp, type ScreenId } from '@/store/app'
import { Icon, type IconName } from '../ui/Icon'
import { Logo } from './Logo'
import { Branding } from './Branding'

const items: { id: ScreenId; icon: IconName }[] = [
  { id: 'hub', icon: 'hub' },
  { id: 'editor', icon: 'editor' },
  { id: 'studio', icon: 'camera' },
  { id: 'archive', icon: 'archive' },
  { id: 'settings', icon: 'settings' }
]

export function Sidebar() {
  const { t } = useTranslation()
  const screen = useApp((s) => s.screen)
  const navigate = useApp((s) => s.navigate)
  const openAbout = useApp((s) => s.setAboutOpen)

  return (
    <nav className="flex h-full w-sidebar flex-none flex-col items-center gap-1.5 border-r border-line bg-ground/85 pb-4 pt-[18px]">
      <button type="button" onClick={() => navigate('hub')} className="mb-[18px]" aria-label="DocForge Hub">
        <Logo />
      </button>

      {items.map((it) => {
        const on = it.id === screen
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => navigate(it.id)}
            aria-current={on ? 'page' : undefined}
            className={`flex w-[72px] flex-col items-center gap-[5px] pb-2 pt-2.5 font-heading text-[11px] font-semibold uppercase leading-none tracking-label transition-colors ${
              on
                ? 'bg-accent-500/15 text-accent-200 shadow-[inset_2px_0_0_rgb(var(--accent-400)),inset_0_0_calc(14px*var(--glow))_rgb(var(--accent-400)/0.18)]'
                : 'text-accent-500 hover:text-accent-300'
            }`}
          >
            <Icon name={it.icon} />
            {t(`nav.${it.id}`)}
          </button>
        )
      })}

      <button
        type="button"
        onClick={() => openAbout(true)}
        className="mt-auto flex flex-col items-center px-1.5"
        title={t('about.title')}
      >
        <span className="mb-2 h-1.5 w-1.5 bg-accent-400 shadow-glow-dot" />
        <Branding />
      </button>
    </nav>
  )
}
