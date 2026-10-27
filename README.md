# DocForge

> Bewerbungen und Dokumente bauen – visuell oder per Befehl.

DocForge ist eine Desktop-App für Windows und macOS, mit der du Lebensläufe, Anschreiben und andere Dokumente erstellst und bearbeitest. Statt dich durch Menüs zu klicken, kannst du auch einfach schreiben, was du willst: *„Mach das Anschreiben formeller“* oder *„Kürz den Lebenslauf auf eine Seite“*.

Alle Daten bleiben auf deinem Gerät. Keine Cloud, kein Account.

---

## ✦ Features

- **Hub:** Schnellaktionen, zuletzt bearbeitete Dokumente, Quest-Fortschritt pro Bewerbung (z. B. „Foto fehlt“), Hinweise (Termine, Nachfassen, Backup), Statistik mit Wochenziel und Erfolgen
- **Dokument-Editor:** Lebenslauf (4 Vorlagen), Anschreiben nach DIN 5008 (3 Vorlagen), Deckblatt, freie Dokumente – A4-Vorschau mit Zoom, Abschnitte per Drag & Drop, Schrift/Farbe/Ränder/Foto einstellbar, automatisches Speichern
- **Export:** PDF (aus der A4-Vorschau) und DOCX (Word)
- **KI-Befehlsleiste (optional):** Dokumente per Text-Befehl mit Claude bearbeiten, Änderungen als Rot/Grün-Vergleich prüfen und einzeln übernehmen, Stellenanzeigen-Abgleich
- **Versionsverlauf:** jede Version wiederherstellbar
- **Kamera-Studio:** Bewerbungsfotos in der höchsten Auflösung der Webcam, Raster/Silhouette, Countdown, Serienbild, Anpassungen, Hintergrund weichzeichnen oder ersetzen (lokal), Zuschnitt 3:4 / Passbild / quadratisch
- **Archiv:** Profile (mehrere Personen), Firmen, Bewerbungen mit Status, Notizen, Termine, Dokumente, Fotos – mit Suche, Filtern und Tags
- **Backup:** komplette Datenbank + Fotos als eine `.dfdb`-Datei, automatisch täglich/wöchentlich
- **Auto-Update** über GitHub Releases (Windows), Daten bleiben erhalten
- **Oberfläche:** Deutsch/Englisch, „Reduzierte Effekte“ für Glow/Animationen

## 🔒 Datenschutz

- Alle Daten werden ausschließlich lokal gespeichert (SQLite-Datei + Fotoordner)
- Keine Telemetrie, kein Tracking, kein Account
- Netzwerkzugriff nur in zwei Fällen: Update-Prüfung bei GitHub (abschaltbar) und – nur wenn du sie aktiv nutzt – die Claude API für die KI-Befehlsleiste
- Die Hintergrund-Erkennung im Kamera-Studio läuft komplett lokal (MediaPipe, mitgeliefert)

---

## 🚀 Installation

### Windows

1. `DocForge-Setup-<version>.exe` unter [Releases](../../releases) herunterladen.
2. Doppelklick. Windows zeigt bei unsignierten Apps „Der Computer wurde durch Windows geschützt“:
   **„Weitere Informationen“ → „Trotzdem ausführen“**.
3. Die Installation läuft **pro Benutzer** – es sind **keine Administratorrechte** nötig.
4. Updates: DocForge prüft beim Start (abschaltbar) bzw. über *Einstellungen → Nach Updates suchen*.
   Vor jedem Update wird automatisch ein Backup angelegt; die Daten bleiben erhalten.

### macOS

1. `DocForge-<version>-arm64.dmg` (Apple Silicon, M1/M2/M3/M4) bzw. `-x64.dmg` (Intel) herunterladen.
2. DMG öffnen, DocForge in „Programme“ ziehen.
3. Die App ist nicht von Apple notarisiert. Beim ersten Start: **Rechtsklick → „Öffnen“** (bzw. ab macOS 15:
   *Systemeinstellungen → Datenschutz & Sicherheit → „Dennoch öffnen“*).
4. Updates: Der Update-Dialog öffnet auf dem Mac die Download-Seite (automatisches Installieren erfordert
   ein kostenpflichtiges Apple-Zertifikat).

### Erste Schritte

Archiv → Profil anlegen (oder „Beispieldaten laden“ zum Ausprobieren) → Hub → „Neuer Lebenslauf“.
Eine ausführliche bebilderte Anleitung liegt unter [`docs/DocForge-Anleitung.pdf`](docs/DocForge-Anleitung.pdf).

---

## 🤖 KI-Befehlsleiste (optional)

Im Editor kannst du Befehle eingeben wie *„Mach das Anschreiben formeller“* oder eine Stellenanzeige
einfügen und *„An die Stellenanzeige anpassen“* wählen. Claude schlägt einzelne Änderungen vor, die als
Rot/Grün-Vergleich angezeigt werden – jede einzeln übernehmbar. Übernommene Änderungen werden als neue
Version gespeichert. Claude erfindet keine Fakten: fehlende Anforderungen aus der Stellenanzeige werden
nur als „Nicht in deinem Profil“ angezeigt.

**Einrichtung:** *Einstellungen → KI-Befehlsleiste* → eigenen API-Key von
[console.anthropic.com](https://console.anthropic.com) eintragen. Modell: Claude Opus 5.5 (Standard),
Sonnet 5.5 oder Haiku 5.5.

> ⚠ **Kosten:** Jede Anfrage wird über das Anthropic-Konto abgerechnet, **zu dem der eingetragene Key gehört**
> (nicht über ein claude.ai-Abo). Trage nur deinen eigenen Key ein und setze in der Console ein Ausgabenlimit.
> Auf geteilten PCs gilt der Key für alle, die dasselbe Benutzerkonto nutzen.

- Der Key wird mit der Verschlüsselung des Betriebssystems gespeichert (Windows DPAPI / macOS Keychain),
  nie im Klartext und nie im Code. Ist keine Verschlüsselung verfügbar, wird er nicht gespeichert.
- Gesendet werden nur Dokumenttext und ggf. Stellenanzeige – keine Fotos, keine Gestaltung.
- Ohne Key funktioniert der Rest der App vollständig.

---

## 💾 Wo liegen die Daten?

Im Nutzerdatenordner von Electron (`app.getPath('userData')`):

| System  | Pfad                                     |
| ------- | ---------------------------------------- |
| Windows | `%APPDATA%\DocForge`                     |
| macOS   | `~/Library/Application Support/DocForge` |
| Linux   | `~/.config/DocForge`                     |

| Datei/Ordner      | Inhalt                                                          |
| ----------------- | --------------------------------------------------------------- |
| `archive.db`      | SQLite-Datenbank (Profile, Dokumente, Versionen, Bewerbungen …) |
| `photos/`         | Fotos in Original-Qualität                                      |
| `backups/`        | Backups (Standard-Ordner, in den Einstellungen änderbar)        |
| `settings.json`   | App-Einstellungen                                               |
| `claude-key.bin`  | API-Key, verschlüsselt (nur wenn eingetragen)                   |

In den Einstellungen öffnet „Öffnen“ den Ordner direkt. Bei der Deinstallation bleiben die Daten erhalten.

### Backup & Wiederherstellung

- **Archiv / Einstellungen → „Jetzt sichern“:** Backup in den Backup-Ordner
- **Archiv → „Export .dfdb“:** Backup an einen frei gewählten Ort (z. B. USB-Stick)
- **Einstellungen → „Aus Datei wiederherstellen …“:** Backup einspielen; vorher wird automatisch ein
  Sicherheits-Backup angelegt (`DocForge-pre-restore-….dfdb`)
- **Automatisch** täglich oder wöchentlich (Standard: wöchentlich); die letzten 10 werden behalten
- Vor Datenbank-Migrationen und vor jedem Update wird ebenfalls automatisch gesichert

Eine `.dfdb`-Datei ist **eine einzige Datei** mit der kompletten Datenbank und allen Fotos
(technisch selbst eine SQLite-Datei mit den Zusatztabellen `backup_meta` und `backup_files`).

---

## 🧯 Fehlerbehebung

| Problem | Lösung |
| --- | --- |
| „Ein anderes Programm greift gerade auf diese Datei zu“ beim Starten des Installers | Der Virenscanner prüft die frisch geladene Datei noch oder der Download ist nicht fertig. 30–60 s warten; im Task-Manager prüfen, ob „DocForge-Setup“ schon läuft; Dateigröße mit der auf GitHub vergleichen; ggf. Datei auf den Desktop verschieben. |
| „Der Computer wurde durch Windows geschützt“ | „Weitere Informationen“ → „Trotzdem ausführen“ (App ist nicht signiert). |
| macOS: „DocForge ist beschädigt“ | Im Terminal: `xattr -cr /Applications/DocForge.app`, dann erneut öffnen. |
| Kamera: „Zugriff verweigert“ | Windows: *Einstellungen → Datenschutz → Kamera* → Desktop-Apps erlauben. macOS: *Datenschutz & Sicherheit → Kamera* → DocForge erlauben. |
| Kamera: „Kamera-Fehler“ | Die Webcam ist evtl. in Teams/Zoom geöffnet – dort schließen und erneut starten. |
| Hintergrund-Erkennung nicht verfügbar | Sehr alte/blockierte Grafiktreiber – Fotos funktionieren trotzdem ohne Hintergrund-Effekt. |
| KI: „Der API-Key wurde abgelehnt“ | Key in der Anthropic Console prüfen bzw. neu erzeugen und in den Einstellungen neu eintragen. |
| Update wird nicht gefunden | Auf GitHub muss ein **veröffentlichter** Release mit `latest.yml` liegen (siehe unten). |

---

## 🛠 Entwicklung

### Voraussetzungen

- Node.js 22, npm 10
- Linux zusätzlich für E2E-Tests ohne Bildschirm: `xvfb`

### Installation & Start

```bash
npm install        # lädt auch das passende SQLite-Binary für Electron (kein Compiler nötig)
npm run dev        # startet die App mit Hot-Reload
```

### Tests

```bash
npm test           # Unit-/Integrationstests: Datenbank, Migrationen, Backup, Export, KI-Logik, Hub, Last
npm run test:e2e   # E2E-Tests: steuert die echte App (Archiv, Editor, Export, Kamera, KI, Hub …)
npm run test:all   # Typecheck + alles
```

Die E2E-Tests nutzen einen temporären Datenordner, eine simulierte Kamera und einen simulierten
Claude-Server – es werden keine echten Daten berührt und keine API-Kosten verursacht.
Unter Linux ohne Bildschirm: `xvfb-run -a npm run test:e2e`.

### Build

```bash
npm run build      # Typecheck + Produktions-Build nach ./out
npm run dist:win   # Windows-Installer (NSIS)  → ./release/<version>/
npm run dist:mac   # macOS (DMG + ZIP)         → ./release/<version>/  (nur auf einem Mac)
```

Den Windows-Installer kann man auf Windows oder unter Linux mit installiertem Wine bauen.

### Neue Version veröffentlichen (GitHub Release + Auto-Update)

Die App sucht Updates im öffentlichen Repo **Lucas-S4ka1/DocForge** (`electron-builder.yml` → `publish`).

1. Versionsnummer in `package.json` erhöhen, z. B. `1.4.0` → `1.5.0`
   (die Anzeige „Version X.X.X · produced by P.J. Works“ aktualisiert sich automatisch).
2. Änderungen committen und pushen.
3. **Variante A – GitHub Actions (empfohlen):** Tag pushen, z. B. `git tag v1.5.0 && git push origin v1.5.0`
   (oder auf GitHub *Actions → Release → Run workflow*). GitHub baut die Installer auf echten
   Windows- und macOS-Rechnern und legt einen **Release-Entwurf** an. Unter *Releases* den Entwurf öffnen,
   Changelog eintragen (erscheint im Update-Dialog), **„Publish release“** klicken – fertig.
4. **Variante B – lokal mit Token:** GitHub-Token (Contents: Read and write) setzen und
   `GH_TOKEN=… npm run release:win` ausführen; danach den Entwurf auf GitHub veröffentlichen.
5. **Variante C – von Hand:** `npm run dist:win`, dann auf GitHub *Releases → Draft a new release*,
   Tag `v1.5.0`, und **alle drei Dateien** aus `release/1.5.0/` hochladen:
   `DocForge-Setup-1.5.0.exe`, `DocForge-Setup-1.5.0.exe.blockmap`, `latest.yml`.
   Ohne `latest.yml` findet die App das Update nicht.

Installierte Apps zeigen danach „[ SYSTEM ] Neue Version 1.5.0 verfügbar“ mit Changelog,
Fortschrittsbalken und „Jetzt neu starten und installieren“. Vor der Installation wird automatisch
ein Backup erstellt; Datenbank-Migrationen laufen beim nächsten Start.

### Datenbank-Migrationen

Das Schema ist versioniert (`PRAGMA user_version`), siehe `src/main/db/migrations.ts`.
Neue Schemaänderungen werden **immer als neue Migration angehängt**, bestehende nie verändert.
Ausstehende Migrationen laufen beim Start automatisch, jede in einer Transaktion; gibt es schon Daten,
wird vorher ein Backup angelegt. Ein Test prüft den Weg von einer 1.x-Datenbank auf den aktuellen Stand.

### Projektstruktur

```
design/                 Design-Screens aus Claude Design (Referenz)
docs/                   Bebilderte Anleitung (PDF)
src/
  shared/               Gemeinsame Typen & Logik: IPC-Vertrag, Modelle, Dokumentmodell, KI-Änderungen
  main/                 Electron Main-Process
    db/                 SQLite: Verbindung, Migrationen, Repositories, Backup, Service
    export/             PDF (printToPDF) und DOCX
    ai/                 Claude API, verschlüsselte Key-Ablage, Prompt
    updater.ts          Auto-Update (electron-updater)
  preload/              Sichere Brücke → window.docforge
  renderer/
    index.html          inkl. strikter Content-Security-Policy
    public/mediapipe/   Lokales KI-Modell + WebAssembly für die Hintergrund-Erkennung
    src/
      theme/tokens.ts   ★ zentrale Design-Tokens (Farben, Glow, Schriften)
      documents/        Dokument-Vorlagen (Vorschau = PDF)
      camera/           Bildverarbeitung & Segmentierung
      screens/          Hub, Editor, Studio, Archiv, Einstellungen
      components/       UI-Bausteine + Layout
      store/            Zustand-Stores
      i18n/             Deutsch (Standard) + Englisch
tests/
  main/                 Unit-/Integrationstests (Vitest, in der Electron-Runtime)
  e2e/                  E2E-Tests (Playwright + Electron)
.github/workflows/      CI (Tests bei jedem Push) und Release (Windows + macOS)
```

### Sicherheit

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, strikte CSP, keine CDNs
- Renderer spricht nur über explizit definierte IPC-Kanäle (`src/shared/ipc.ts`); Datenbank-Aufrufe
  laufen über eine Allowlist erlaubter Methoden, alle Eingaben werden mit Zod geprüft
- Keine Navigation/Fenster nach außen; Berechtigungen standardmäßig verweigert (nur Kamera-Video)
- Fehlermeldungen und Logs enthalten keine personenbezogenen Daten (nur Fehlercodes)
- Test-Schalter (`DOCFORGE_TEST_*`, `DOCFORGE_AI_BASE_URL`) wirken nur im Entwicklungsmodus, nie in der installierten App

### Hinweis zur Electron-Version

DocForge nutzt Electron 42, weil better-sqlite3 dafür fertige Binaries für Windows, macOS und Linux
anbietet (kein C++-Compiler nötig). Sobald better-sqlite3 Binaries für neuere Electron-Versionen
veröffentlicht, kann `electron` in `package.json` angehoben werden.

---

**Version** siehe `package.json` · **produced by P.J. Works**
