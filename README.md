# DocForge

Dokument- und Bewerbungs-Builder: Dokumente visuell **und** per Text-Prompt bearbeiten.
Alles bleibt lokal auf dem Gerät – keine Cloud, kein Account, keine Telemetrie.

> Stand: **Phase 1** – Projekt-Setup, Theme/Design-Tokens, Layout, leere Screens, Branding.
> Die vollständige Anleitung (Daten, Backup, Updates, Releases) folgt mit den nächsten Phasen.

## Voraussetzungen

- Node.js 20+ (getestet mit 22)
- npm 10+

## Installation & Start

```bash
npm install
npm run dev        # startet die App mit Hot-Reload
```

## Build

```bash
npm run build      # Typecheck + Produktions-Build nach ./out
npm run dist:win   # Windows-Installer (NSIS)  → ./release/<version>/
npm run dist:mac   # macOS (DMG + ZIP)         → ./release/<version>/
```

Hinweis: Den macOS-Build am besten auf einem Mac erstellen, den Windows-Build auf Windows.

## Wo liegen die Daten?

Im Nutzerdatenordner von Electron (`app.getPath('userData')`):

| System  | Pfad                                         |
| ------- | -------------------------------------------- |
| Windows | `%APPDATA%\DocForge`                         |
| macOS   | `~/Library/Application Support/DocForge`     |
| Linux   | `~/.config/DocForge`                         |

Aktuell: `settings.json` (Einstellungen). Ab Phase 2 kommen dort die SQLite-Datenbank und der Foto-Ordner dazu.
Der Ordner lässt sich in den Einstellungen über „Öffnen“ anzeigen.

## Projektstruktur

```
design/                 Design-Screens aus Claude Design (Referenz)
src/
  shared/               Gemeinsame Typen: IPC-Vertrag, Einstellungen
  main/                 Electron Main-Process (Fenster, Sicherheit, IPC, Menü)
  preload/              Sichere Brücke → window.docforge
  renderer/
    index.html          inkl. strikter Content-Security-Policy
    src/
      theme/tokens.ts   ★ zentrale Design-Tokens (Farben, Glow, Schriften)
      styles/           globale Styles, Blueprint-Panels, Effekte
      i18n/             Deutsch (Standard) + Englisch
      store/            Zustand-Stores
      components/       UI-Bausteine + Layout (Seitenleiste, Branding, About)
      screens/          Hub, Editor, Studio, Archiv, Einstellungen
```

## Sicherheit

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- Renderer spricht nur über explizit definierte IPC-Kanäle (`src/shared/ipc.ts`)
- Keine Navigation/Fenster nach außen; Berechtigungen standardmäßig verweigert (nur Kamera-Video erlaubt)
- Schriften lokal gebündelt (@fontsource), keine CDNs
