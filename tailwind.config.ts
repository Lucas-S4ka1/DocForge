import type { Config } from 'tailwindcss'
import { surface, status, layout, fontFallback } from './src/renderer/src/theme/tokens'

/** Akzentfarbe als CSS-Variable mit Alpha-Unterstützung (Werte setzt applyTheme()). */
const accentVar = (step: number) => `rgb(var(--accent-${step}) / <alpha-value>)`
const steps = [100, 200, 300, 400, 500, 600, 700, 800, 900]

export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: surface.void,
        ground: surface.base,
        raised: surface.raised,
        panel: surface.panel,
        paper: surface.paper,
        'paper-ink': surface.paperInk,
        accent: Object.fromEntries(steps.map((s) => [s, accentVar(s)])),
        // Hairline-Rahmen wie in den Screens: accent-400 mit 26 % Deckkraft
        line: 'rgb(var(--accent-400) / 0.26)',
        success: status.success,
        danger: status.danger,
        warning: status.warning
      },
      fontFamily: {
        heading: ['var(--font-heading)'],
        body: ['var(--font-body)'],
        mono: [fontFallback.mono]
      },
      spacing: {
        sidebar: layout.sidebarWidth,
        header: layout.headerHeight
      },
      letterSpacing: {
        system: '0.14em',
        label: '0.12em'
      },
      boxShadow: {
        // Glow-Schatten skalieren mit --glow (0 = aus, z. B. bei "Reduzierte Effekte")
        glow: '0 0 calc(22px * var(--glow)) rgb(var(--accent-400) / calc(0.18 * var(--glow))), inset 0 0 calc(22px * var(--glow)) rgb(var(--accent-400) / calc(0.12 * var(--glow)))',
        'glow-sm': '0 0 calc(16px * var(--glow)) rgb(var(--accent-400) / calc(0.4 * var(--glow)))',
        'glow-dot': '0 0 calc(8px * var(--glow)) rgb(var(--accent-400) / var(--glow))',
        'inner-panel': 'inset 0 0 30px rgb(var(--accent-500) / calc(0.07 * var(--glow)))',
        paper: '0 0 0 1px rgb(var(--accent-400) / 0.4), 0 20px 60px #000'
      }
    }
  },
  plugins: []
} satisfies Config
