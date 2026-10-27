/**
 * Renderer-Einstieg. Schriften werden lokal aus node_modules gebündelt (kein CDN).
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Design-Schriften (Barlow Condensed / Barlow)
import '@fontsource/barlow-condensed/400.css'
import '@fontsource/barlow-condensed/600.css'
import '@fontsource/barlow/400.css'
import '@fontsource/barlow/500.css'
import '@fontsource/barlow/700.css'
// Alternative Schriftpaare (Rajdhani / Exo 2 + Inter)
import '@fontsource/rajdhani/500.css'
import '@fontsource/rajdhani/600.css'
import '@fontsource/exo-2/500.css'
import '@fontsource/exo-2/600.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/700.css'
// Dokumentschrift (Serif-Variante)
import '@fontsource/source-serif-4/400.css'
import '@fontsource/source-serif-4/600.css'
import '@fontsource/source-serif-4/700.css'

import './styles/globals.css'
import './i18n'
import { App } from './app/App'
import { PrintApp } from './documents/PrintApp'

// "#print" = unsichtbares Fenster für den PDF-Export
const isPrint = window.location.hash === '#print'

createRoot(document.getElementById('root')!).render(<StrictMode>{isPrint ? <PrintApp /> : <App />}</StrictMode>)
