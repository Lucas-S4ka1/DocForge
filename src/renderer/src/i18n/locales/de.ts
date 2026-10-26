/** Deutsche UI-Texte (Standardsprache). Schlüsselstruktur ist für alle Sprachen identisch. */
const de = {
  nav: {
    hub: 'Hub',
    editor: 'Editor',
    studio: 'Studio',
    archive: 'Archiv',
    settings: 'Settings'
  },
  brand: {
    version: 'Version {{version}}',
    producedBy: 'produced by P.J. Works',
    tagline: 'Dokument- & Bewerbungs-Builder. Offline, lokal, deins.'
  },
  common: {
    localStorage: 'Lokaler Speicher · Offline',
    localStorageLong: 'Lokaler Speicher · Daten bleiben auf diesem Gerät',
    comingInPhase: 'Wird in Phase {{phase}} freigeschaltet',
    close: 'Schließen',
    profile: 'Profil: {{name}}',
    noProfile: 'Kein Profil'
  },
  hub: {
    system: '[ SYSTEM ] Sitzung gestartet · {{date}}',
    welcome: 'Willkommen bei DocForge',
    welcomeBack: 'Willkommen zurück, {{name}}',
    actions: {
      newCv: 'Neuer Lebenslauf',
      newCvHint: 'Strg + N',
      newLetter: 'Neues Anschreiben',
      newLetterHint: 'Strg + L',
      newDoc: 'Neues Dokument',
      newDocHint: 'Leer oder aus Vorlage',
      camera: 'Kamera-Studio',
      cameraHint: 'Bewerbungsfoto'
    },
    recent: 'Zuletzt bearbeitet',
    viewArchive: 'Archiv öffnen →',
    recentEmpty: 'Noch keine Dokumente. Lege oben deinen ersten Lebenslauf an.',
    quests: 'Aktive Bewerbungen',
    questsEmpty: 'Keine aktiven Bewerbungen. Quests erscheinen hier, sobald du eine Bewerbung anlegst.',
    stats: 'Statistik',
    statApplications: 'Bewerbungen',
    statDrafts: 'Entwürfe',
    statSent: 'Gesendet',
    statInterviews: 'Gespräche'
  },
  editor: {
    crumb: 'Editor /',
    untitled: 'Kein Dokument geöffnet',
    structure: '[ STRUKTUR ]',
    template: '[ VORLAGE ]',
    properties: '[ EIGENSCHAFTEN ]',
    addSection: '+ Abschnitt hinzufügen',
    templates: 'Vorlagen',
    exportDocx: 'Export DOCX',
    exportPdf: 'Export PDF',
    commandPlaceholder: 'Befehl eingeben …',
    run: 'Ausführen',
    emptyTitle: 'Kein Dokument geöffnet',
    emptyHint: 'Öffne ein Dokument im Hub oder Archiv, oder lege ein neues an.'
  },
  studio: {
    title: 'Kamera-Studio',
    capture: '[ AUFNAHME ]',
    overlays: '[ OVERLAYS ]',
    crop: '[ ZUSCHNITT ]',
    adjust: '[ ANPASSEN ]',
    background: '[ HINTERGRUND ]',
    cameraOff: 'Kamera aus',
    cameraOffHint: 'Die Kamera wird erst nach deinem Klick aktiviert. Alles wird lokal verarbeitet.',
    startCamera: 'Kamera starten',
    processedLocally: 'Lokal verarbeitet'
  },
  archive: {
    system: '[ DATENBANK ] {{apps}} Bewerbungen · {{docs}} Dokumente · {{photos}} Fotos',
    title: 'Archiv',
    tabs: {
      applications: 'Bewerbungen',
      documents: 'Dokumente',
      photos: 'Fotos',
      companies: 'Firmen',
      profiles: 'Profile'
    },
    search: 'Firmen, Rollen, Notizen durchsuchen …',
    allStatuses: 'Alle Status',
    addFilter: '+ Filter',
    export: 'Export .dfdb',
    backupNow: 'Jetzt sichern',
    columns: {
      company: 'Firma',
      role: 'Rolle',
      documents: 'Dokumente',
      status: 'Status',
      updated: 'Aktualisiert'
    },
    empty: 'Das Archiv ist noch leer.',
    record: '[ DATENSATZ ]',
    noRecord: 'Wähle links einen Eintrag aus.'
  },
  settings: {
    config: '[ CONFIG ]',
    title: 'Einstellungen',
    appearance: 'Darstellung',
    themeIntensity: 'Theme-Intensität',
    glow: 'Glow-Effekte',
    glowHint: 'Neon-Kanten und Lichtschimmer',
    reducedEffects: 'Reduzierte Effekte',
    reducedEffectsHint: 'Schaltet Glow und Animationen ab',
    scanlines: 'Scanline-Textur',
    scanlinesHint: 'Raster hinter den Panels',
    palette: 'Akzentfarbe',
    paletteSteel: 'Stahl',
    paletteNeon: 'Neon',
    fonts: 'Schriftpaar',
    language: 'Sprache',
    storage: 'Speicher & Backup',
    dataLocation: 'Speicherort',
    openFolder: 'Öffnen',
    autoBackup: 'Automatisches Backup',
    backupOff: 'Aus',
    backupDaily: 'Täglich',
    backupWeekly: 'Wöchentlich',
    backupNow: 'Jetzt sichern',
    restore: 'Aus Datei wiederherstellen …',
    privacy: 'Keine Cloud, kein Account. Nichts verlässt dieses Gerät.',
    ai: 'KI-Befehlsleiste',
    apiKey: 'Claude API-Key',
    apiKeyHint: 'Wird verschlüsselt auf diesem Gerät gespeichert.',
    model: 'Modell',
    updates: 'Updates',
    checkOnStart: 'Beim Start nach Updates suchen',
    checkOnStartHint: 'Nur eine kurze Anfrage an GitHub Releases',
    about: '[ ABOUT ]',
    checkUpdates: 'Nach Updates suchen'
  },
  about: {
    title: 'Über DocForge'
  }
}

export default de
export type Messages = typeof de
