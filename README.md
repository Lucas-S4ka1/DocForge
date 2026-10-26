# DocForge

Dokument- und Bewerbungs-Builder: Dokumente visuell **und** per Text-Prompt bearbeiten.
Alles bleibt lokal auf dem Gerät – keine Cloud, kein Account, keine Telemetrie.

> Stand: **Phase 2** – lokale SQLite-Datenbank, Migrationen, IPC-Schicht, Archiv mit Suche/Filter/Tags, Backup & Wiederherstellung.
> Die vollständige Anleitung (Daten, Backup, Updates, Releases) folgt mit den nächsten Phasen.

## Voraussetzungen

- Node.js 20+ (getestet mit 22)
- npm 10+

## Installation & Start

```bash
npm install        # lädt auch das passende SQLite-Binary für Electron (kein Compiler nötig)
npm run dev        # startet die App mit Hot-Reload
npm test           # Tests der Datenschicht (laufen in der Electron-Runtime)
```

Zum Ausprobieren: Archiv → „Beispieldaten laden“ (fiktive Personen und Firmen).

## Build

```bash
npm run build      # Typecheck + Produktions-Build nach ./out
npm run dist:win   # Windows-Installer (NSIS)  → ./release/<version>/
npm run dist:mac   # macOS (DMG + ZIP)         → ./release/<version>/
```

Hinweis: Den macOS-Build am besten auf einem Mac erstellen, den Windows-Build auf Windows.

## Wo liegen die Daten?

Alles bleibt ausschließlich auf dem Gerät – keine Cloud, kein Account, keine Telemetrie.
Speicherort ist der Nutzerdatenordner von Electron (`app.getPath('userData')`):

| System  | Pfad                                         |
| ------- | -------------------------------------------- |
| Windows | `%APPDATA%\DocForge`                         |
| macOS   | `~/Library/Application Support/DocForge`     |
| Linux   | `~/.config/DocForge`                         |

Inhalt:

| Datei/Ordner     | Inhalt                                                        |
| ---------------- | ------------------------------------------------------------- |
| `archive.db`     | SQLite-Datenbank (Profile, Dokumente, Versionen, Bewerbungen …) |
| `photos/`        | Fotos als Bilddateien                                         |
| `backups/`       | Backups (Standard-Ordner, in den Einstellungen änderbar)      |
| `settings.json`  | App-Einstellungen                                             |

In den Einstellungen zeigt „Öffnen“ den Ordner direkt an.

### Backup & Wiederherstellung

- **Archiv → „Jetzt sichern“** oder **Einstellungen → „Jetzt sichern“**: Backup in den Backup-Ordner
- **Archiv → „Export .dfdb“**: Backup an einen frei gewählten Ort speichern
- **Einstellungen → „Aus Datei wiederherstellen …“**: Backup einspielen. Vorher wird automatisch ein
  Sicherheits-Backup des aktuellen Stands angelegt (`DocForge-pre-restore-….dfdb`).
- **Automatisches Backup** (täglich/wöchentlich, Standard: wöchentlich). Die letzten 10 automatischen Backups werden behalten.

Eine `.dfdb`-Datei ist **eine einzige Datei** mit der kompletten Datenbank und allen Fotos
(technisch selbst eine SQLite-Datei mit den Zusatztabellen `backup_meta` und `backup_files`).

### Datenbank-Migrationen

Das Schema ist versioniert (`PRAGMA user_version`), siehe `src/main/db/migrations.ts`.
Neue Schemaänderungen werden **immer als neue Migration angehängt**, bestehende nie verändert.
Beim Start laufen ausstehende Migrationen automatisch, jede in einer Transaktion.
Gibt es schon Daten, wird **vorher automatisch ein Backup** angelegt (`DocForge-pre-migration-….dfdb`).

## Projektstruktur

```
design/                 Design-Screens aus Claude Design (Referenz)
src/
  shared/               Gemeinsame Typen: IPC-Vertrag, Einstellungen
  main/                 Electron Main-Process (Fenster, Sicherheit, IPC, Menü)
    db/                 SQLite: Verbindung, Migrationen, Repositories, Backup, Service
  preload/              Sichere Brücke → window.docforge
  renderer/
    index.html          inkl. strikter Content-Security-Policy
    src/
      theme/tokens.ts   ★ zentrale Design-Tokens (Farben, Glow, Schriften)
      styles/           globale Styles, Blueprint-Panels, Effekte
      i18n/             Deutsch (Standard) + Englisch
      store/            Zustand-Stores (App, Archiv, Daten-Hooks, Systemmeldungen)
      components/       UI-Bausteine + Layout (Seitenleiste, Branding, About)
      screens/          Hub, Editor, Studio, Archiv (archive/), Einstellungen
tests/                  Tests (Vitest)
```

## Sicherheit

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- Renderer spricht nur über explizit definierte IPC-Kanäle (`src/shared/ipc.ts`);
  Datenbank-Aufrufe laufen über eine Allowlist erlaubter Methoden, alle Eingaben werden mit Zod geprüft
- Fehlermeldungen und Logs enthalten keine personenbezogenen Daten (nur Fehlercodes)
- Keine Navigation/Fenster nach außen; Berechtigungen standardmäßig verweigert (nur Kamera-Video erlaubt)
- Schriften lokal gebündelt (@fontsource), keine CDNs

## Hinweis zur Electron-Version

DocForge nutzt Electron 42, weil better-sqlite3 dafür fertige Binaries für Windows, macOS und Linux
anbietet (kein C++-Compiler nötig). Sobald better-sqlite3 Binaries für neuere Electron-Versionen
veröffentlicht, kann `electron` in `package.json` einfach angehoben werden.
