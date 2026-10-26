import type { Messages } from './de'

/** English UI strings. Must mirror the structure of de.ts (enforced by the type). */
const en: Messages = {
  nav: {
    hub: 'Hub',
    editor: 'Editor',
    studio: 'Studio',
    archive: 'Archive',
    settings: 'Settings'
  },
  brand: {
    version: 'Version {{version}}',
    producedBy: 'produced by P.J. Works',
    tagline: 'Document & application builder. Offline, local, yours.'
  },
  common: {
    localStorage: 'Local storage · Offline',
    localStorageLong: 'Local storage · Data stays on this device',
    comingInPhase: 'Unlocked in phase {{phase}}',
    close: 'Close',
    profile: 'Profile: {{name}}',
    noProfile: 'No profile'
  },
  hub: {
    system: '[ SYSTEM ] Session started · {{date}}',
    welcome: 'Welcome to DocForge',
    welcomeBack: 'Welcome back, {{name}}',
    actions: {
      newCv: 'New CV',
      newCvHint: 'Ctrl + N',
      newLetter: 'New cover letter',
      newLetterHint: 'Ctrl + L',
      newDoc: 'New document',
      newDocHint: 'Blank or from template',
      camera: 'Camera studio',
      cameraHint: 'Application photo'
    },
    recent: 'Recent documents',
    viewArchive: 'View archive →',
    recentEmpty: 'No documents yet. Create your first CV above.',
    quests: 'Active applications',
    questsEmpty: 'No active applications. Quests show up here once you create an application.',
    stats: 'Stats',
    statApplications: 'Applications',
    statDrafts: 'Drafts',
    statSent: 'Sent',
    statInterviews: 'Interviews'
  },
  editor: {
    crumb: 'Editor /',
    untitled: 'No document open',
    structure: '[ STRUCTURE ]',
    template: '[ TEMPLATE ]',
    properties: '[ PROPERTIES ]',
    addSection: '+ Add section',
    templates: 'Templates',
    exportDocx: 'Export DOCX',
    exportPdf: 'Export PDF',
    commandPlaceholder: 'Enter command …',
    run: 'Run',
    emptyTitle: 'No document open',
    emptyHint: 'Open a document from the hub or archive, or create a new one.'
  },
  studio: {
    title: 'Camera studio',
    capture: '[ CAPTURE ]',
    overlays: '[ OVERLAYS ]',
    crop: '[ CROP ]',
    adjust: '[ ADJUST ]',
    background: '[ BACKGROUND ]',
    cameraOff: 'Camera off',
    cameraOffHint: 'The camera only turns on after you click. Everything is processed locally.',
    startCamera: 'Start camera',
    processedLocally: 'Processed locally'
  },
  archive: {
    system: '[ DATABASE ] {{apps}} applications · {{docs}} documents · {{photos}} photos',
    title: 'Archive',
    tabs: {
      applications: 'Applications',
      documents: 'Documents',
      photos: 'Photos',
      companies: 'Companies',
      profiles: 'Profiles'
    },
    search: 'Search companies, roles, notes …',
    allStatuses: 'All statuses',
    addFilter: '+ Filter',
    export: 'Export .dfdb',
    backupNow: 'Backup now',
    columns: {
      company: 'Company',
      role: 'Role',
      documents: 'Documents',
      status: 'Status',
      updated: 'Updated'
    },
    empty: 'The archive is still empty.',
    record: '[ RECORD ]',
    noRecord: 'Select an entry on the left.'
  },
  settings: {
    config: '[ CONFIG ]',
    title: 'Settings',
    appearance: 'Appearance',
    themeIntensity: 'Theme intensity',
    glow: 'Glow effects',
    glowHint: 'Neon edges and light sweeps',
    reducedEffects: 'Reduced effects',
    reducedEffectsHint: 'Turns off glow and animations',
    scanlines: 'Scanline texture',
    scanlinesHint: 'Grid behind panels',
    palette: 'Accent color',
    paletteSteel: 'Steel',
    paletteNeon: 'Neon',
    fonts: 'Font pairing',
    language: 'Language',
    storage: 'Storage & backup',
    dataLocation: 'Data location',
    openFolder: 'Open',
    autoBackup: 'Automatic backup',
    backupOff: 'Off',
    backupDaily: 'Daily',
    backupWeekly: 'Weekly',
    backupNow: 'Backup now',
    restore: 'Restore from file …',
    privacy: 'No cloud, no account. Nothing leaves this device.',
    ai: 'AI command bar',
    apiKey: 'Claude API key',
    apiKeyHint: 'Stored encrypted on this device.',
    model: 'Model',
    updates: 'Updates',
    checkOnStart: 'Check for updates on start',
    checkOnStartHint: 'Just a short request to GitHub Releases',
    about: '[ ABOUT ]',
    checkUpdates: 'Check for updates'
  },
  about: {
    title: 'About DocForge'
  }
}

export default en
