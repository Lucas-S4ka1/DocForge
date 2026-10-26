/**
 * DocForge – zentrale Design-Tokens.
 *
 * Einzige Quelle der Wahrheit für Farben, Glow, Schriften und Abstände.
 * - `tailwind.config.ts` liest diese Datei und erzeugt daraus die Utility-Klassen.
 * - `applyTheme()` schreibt die laufzeitabhängigen Werte (Akzent-Palette, Glow-Stärke,
 *   Schriftpaar) als CSS-Variablen auf <html>, damit Einstellungen sofort wirken.
 *
 * Die Akzent-Rampen sind als RGB-Tripel hinterlegt, damit Tailwind Alpha-Modifier
 * (z. B. `bg-accent-500/20`) über `rgb(var(--accent-500) / <alpha-value>)` nutzen kann.
 */

/** Hilfsfunktion: "#RRGGBB" → "R G B" (für CSS-Variablen mit Alpha-Unterstützung). */
export function hexToRgbTriplet(hex: string): string {
  const v = hex.replace('#', '')
  const n = parseInt(v, 16)
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`
}

/** Hintergrundtöne der App (die Dokumente selbst bleiben weiß). */
export const surface = {
  void: '#05070D', // tiefster Grund (Fenster, Kamera-Feed)
  base: '#0A0F1C', // App-Hintergrund
  raised: '#0E1624', // Seitenleiste, Kopfzeilen
  panel: '#111B2A', // gefüllte Flächen in Panels
  paper: '#FFFFFF', // Dokumentpapier
  paperInk: '#2B2B2D' // Textfarbe auf dem Papier
} as const

/** Akzent-Stufen 100 (hell) … 900 (dunkel). */
export type AccentRamp = Record<100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900, string>

/**
 * "Stahl" – exakt die Rampe aus den Claude-Design-Screens (Industry Design System).
 * Gedämpftes Stahlblau, wie in den Mockups.
 */
export const steelRamp: AccentRamp = {
  100: '#EEF6FF',
  200: '#D6EBFF',
  300: '#B5D9FD',
  400: '#94BCE3',
  500: '#749DC4',
  600: '#597EA3',
  700: '#416180',
  800: '#2C455D',
  900: '#1D2D3D'
}

/**
 * "Neon" – kräftige Neonblau-Rampe aus der Spezifikation
 * (#1E90FF, #3FA9FF, #00D4FF als Kernfarben).
 */
export const neonRamp: AccentRamp = {
  100: '#E6F7FF',
  200: '#B8E9FF',
  300: '#00D4FF',
  400: '#3FA9FF',
  500: '#1E90FF',
  600: '#1872D9',
  700: '#1458AB',
  800: '#0F3E78',
  900: '#0A2448'
}

export const accentPalettes = { steel: steelRamp, neon: neonRamp } as const
export type AccentPalette = keyof typeof accentPalettes

/** Statusfarben (Diff, Fehler, Erfolg). Bewusst entsättigt, damit sie zum Blau passen. */
export const status = {
  success: '#4ADE80',
  successBg: '#DCFCE7',
  danger: '#F87171',
  dangerBg: '#FEE2E2',
  warning: '#FBBF24'
} as const

/**
 * Schriftpaare. Alle Schriften werden lokal über @fontsource gebündelt (kein CDN).
 * - "design": Barlow Condensed / Barlow – wie in den Design-Screens
 * - "rajdhani": Rajdhani / Inter
 * - "exo": Exo 2 / Inter
 */
export const fontPairs = {
  design: { heading: "'Barlow Condensed'", body: "'Barlow'" },
  rajdhani: { heading: "'Rajdhani'", body: "'Inter'" },
  exo: { heading: "'Exo 2'", body: "'Inter'" }
} as const
export type FontPair = keyof typeof fontPairs

export const fontFallback = {
  sans: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  mono: 'ui-monospace, "Cascadia Mono", Menlo, Consolas, monospace'
} as const

/** Layout-Maße aus den Screens (1440×900 Referenz). */
export const layout = {
  sidebarWidth: '88px',
  headerHeight: '58px',
  gridSize: '32px'
} as const

/** Laufzeit-Theme-Einstellungen, die aus den App-Einstellungen kommen. */
export interface ThemeOptions {
  palette: AccentPalette
  fontPair: FontPair
  /** 0–100: skaliert die Glow-Stärke. */
  intensity: number
  glow: boolean
  reducedEffects: boolean
  scanlines: boolean
}

/**
 * Schreibt die Theme-Optionen als CSS-Variablen/Attribute auf <html>.
 * Die CSS-Regeln in `styles/globals.css` reagieren darauf.
 */
export function applyTheme(opts: ThemeOptions, root: HTMLElement = document.documentElement): void {
  const ramp = accentPalettes[opts.palette]
  for (const [step, hex] of Object.entries(ramp)) {
    root.style.setProperty(`--accent-${step}`, hexToRgbTriplet(hex))
  }
  const pair = fontPairs[opts.fontPair]
  root.style.setProperty('--font-heading', `${pair.heading}, ${fontFallback.sans}`)
  root.style.setProperty('--font-body', `${pair.body}, ${fontFallback.sans}`)

  // Glow-Stärke 0…1 – bei "Reduzierte Effekte" oder deaktiviertem Glow immer 0.
  const glowOn = opts.glow && !opts.reducedEffects
  const strength = glowOn ? Math.max(0, Math.min(100, opts.intensity)) / 70 : 0
  root.style.setProperty('--glow', strength.toFixed(3))

  root.dataset.fx = opts.reducedEffects ? 'reduced' : 'full'
  root.dataset.scanlines = opts.scanlines && !opts.reducedEffects ? 'on' : 'off'
}
