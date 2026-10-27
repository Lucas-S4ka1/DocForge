# DocForge

> Bewerbungen und Dokumente bauen – visuell oder per Befehl.

DocForge ist eine Desktop-App für Windows und macOS, mit der du Lebensläufe, Anschreiben und andere Dokumente erstellst und bearbeitest. Statt dich durch Menüs zu klicken, kannst du einfach schreiben, was du willst: *„Mach das Anschreiben formeller“* oder *„Kürz den Lebenslauf auf eine Seite“*.

Alle Daten bleiben auf deinem Gerät. Keine Cloud, kein Account.

---

## ✦ Features

- **Dokument-Editor:** Lebenslauf, Anschreiben (DIN 5008), Deckblatt und freie Dokumente mit professionellen Vorlagen und A4-Vorschau
- **Prompt-Befehlsleiste:** Dokumente per Texteingabe bearbeiten, Änderungen als Vorher/Nachher-Vergleich prüfen und übernehmen
- **Stellenanzeigen-Abgleich:** Anzeige einfügen, passende Skills werden hervorgehoben und das Anschreiben angepasst
- **Kamera-Studio:** Bewerbungsfotos in hoher Qualität direkt in der App, mit Raster, Countdown, Hintergrund-Weichzeichner und Zuschnitt-Vorlagen
- **Lokales Archiv:** Profile, Dokumente, Fotos und Bewerbungsstatus in einer lokalen Datenbank, mit Suche, Filtern und Backup
- **Versionsverlauf:** jede Änderung nachvollziehbar und wiederherstellbar
- **Export:** PDF und DOCX
- **Auto-Update:** neue Versionen direkt aus der App installieren, deine Daten bleiben erhalten

## 🔒 Datenschutz

- Alle Daten werden ausschließlich lokal gespeichert
- Keine Telemetrie, kein Tracking
- Die Prompt-Funktion nutzt die Claude API nur, wenn du sie aktiv verwendest und einen eigenen API-Key hinterlegst. Der Key wird verschlüsselt auf deinem Gerät gespeichert
- Die Hintergrundbearbeitung im Kamera-Studio läuft komplett lokal

## 🛠 Tech-Stack

Electron · React · TypeScript · Vite · Tailwind CSS · SQLite · Anthropic SDK · MediaPipe

---

> Stand **Version 1.0.0**: Phasen 1–3 (Layout, lokale Datenbank & Archiv, Dokument-Editor mit Vorlagen,
> PDF/DOCX-Export) plus Auto-Update. Kamera-Studio und KI-Befehlsleiste folgen als Updates.

## 🚀 Installation (Windows)

1. `DocForge-Setup-<version>.exe` unter [Releases](../../releases) herunterladen.
2. Doppelklick. Windows zeigt bei unsignierten Apps „Der Computer wurde durch Windows geschützt“:
   **„Weitere Informationen“ → „Trotzdem ausführen“**.
3. Die Installation läuft **pro Benutzer** – es sind **keine Administratorrechte** nötig.
4. Updates: DocForge prüft beim Start (abschaltbar) bzw. über *Einstellungen → Nach Updates suchen*.
   Vor jedem Update wird automatisch ein Backup angelegt; die Daten bleiben erhalten.

Erste Schritte: Archiv → Profil anlegen (oder „Beispieldaten laden“) → Hub → „Neuer Lebenslauf“.
Ein Bewerbungsfoto lässt sich im Editor unter *Design → Foto aus Datei …* einfügen.


## 🛠 Entwicklung

### Voraussetzungen

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

Hinweis: Den macOS-Build auf einem Mac erstellen. Den Windows-Build kann man auf Windows oder
unter Linux (mit installiertem Wine) erstellen.

## Neue Version veröffentlichen (GitHub Release + Auto-Update)

Die App sucht Updates im öffentlichen Repo **Lucas-S4ka1/DocForge** (`electron-builder.yml` → `publish`).

1. Versionsnummer in `package.json` erhöhen, z. B. `1.0.0` → `1.1.0`
   (die Versionsanzeige „Version X.X.X · produced by P.J. Works“ aktualisiert sich automatisch).
2. Änderungen committen und pushen.
3. **Variante A – automatisch:** GitHub-Token mit Recht „Contents: Read and write“ anlegen
   (GitHub → Settings → Developer settings → Fine-grained tokens) und bauen + hochladen:
   ```bash
   # Windows (PowerShell):  $env:GH_TOKEN="ghp_…" ;  npm run release:win
   # macOS/Linux:           GH_TOKEN=ghp_… npm run release:win
   ```
   electron-builder legt einen **Entwurf** des Releases an. Auf GitHub Release-Notes (= Changelog
   im Update-Dialog) eintragen und auf **„Publish release“** klicken.
4. **Variante B – von Hand:** `npm run dist:win`, dann auf GitHub *Releases → Draft a new release*,
   Tag `v1.1.0`, und **alle drei Dateien** aus `release/1.1.0/` hochladen:
   `DocForge-Setup-1.1.0.exe`, `DocForge-Setup-1.1.0.exe.blockmap`, `latest.yml`.
   Ohne `latest.yml` findet die App das Update nicht.

Installierte Apps zeigen danach „[ SYSTEM ] Neue Version 1.1.0 verfügbar“ mit Changelog,
Download-Fortschritt und „Jetzt neu starten und installieren“. Vor der Installation wird
automatisch ein Backup erstellt; Datenbank-Migrationen laufen beim nächsten Start.

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
| `photos/`        | Fotos als Bilddateien (Original-Qualität)                     |
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
