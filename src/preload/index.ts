/**
 * Preload – die einzige Brücke zwischen Renderer und Main-Process.
 * Stellt eine schmale, typisierte API unter `window.docforge` bereit.
 * Es wird nie `ipcRenderer` selbst durchgereicht.
 */
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IpcChannels, dbMethodNames, type DbApi, type DocForgeApi, type MenuAction, type UpdateStatus } from '@shared/ipc'

/** Baut aus der Allowlist typisierte Proxys: db.applications.list(…) → invoke('db:call', 'applications', 'list', […]) */
function buildDbApi(): DbApi {
  const api: Record<string, Record<string, (...args: unknown[]) => Promise<unknown>>> = {}
  for (const [ns, methods] of Object.entries(dbMethodNames)) {
    api[ns] = {}
    for (const m of methods as string[]) {
      api[ns][m] = (...args: unknown[]) => ipcRenderer.invoke(IpcChannels.dbCall, ns, m, args)
    }
  }
  return api as unknown as DbApi
}

const api: DocForgeApi = {
  app: {
    getInfo: () => ipcRenderer.invoke(IpcChannels.appInfo),
    openDataFolder: () => ipcRenderer.invoke(IpcChannels.openExternalDataFolder)
  },
  settings: {
    get: () => ipcRenderer.invoke(IpcChannels.settingsGet),
    set: (patch) => ipcRenderer.invoke(IpcChannels.settingsSet, patch)
  },
  db: buildDbApi(),
  archive: {
    info: () => ipcRenderer.invoke(IpcChannels.archiveInfo),
    backupNow: () => ipcRenderer.invoke(IpcChannels.archiveBackupNow),
    exportBackup: () => ipcRenderer.invoke(IpcChannels.archiveExport),
    restoreBackup: () => ipcRenderer.invoke(IpcChannels.archiveRestore),
    chooseBackupFolder: () => ipcRenderer.invoke(IpcChannels.archiveChooseBackupFolder),
    openBackupFolder: () => ipcRenderer.invoke(IpcChannels.archiveOpenBackupFolder),
    seedDemo: () => ipcRenderer.invoke(IpcChannels.archiveSeedDemo)
  },
  importer: {
    pickFile: () => ipcRenderer.invoke(IpcChannels.documentImport)
  },
  photos: {
    importFromFile: (profileId) => ipcRenderer.invoke(IpcChannels.photoImport, profileId),
    saveCaptured: (input) => ipcRenderer.invoke(IpcChannels.photoSaveCaptured, input)
  },
  camera: {
    requestAccess: () => ipcRenderer.invoke(IpcChannels.cameraAccess)
  },
  exporter: {
    pdf: (id) => ipcRenderer.invoke(IpcChannels.exportPdf, id),
    docx: (id) => ipcRenderer.invoke(IpcChannels.exportDocx, id)
  },
  print: {
    getDoc: () => ipcRenderer.invoke(IpcChannels.printGetDoc),
    ready: () => ipcRenderer.send(IpcChannels.printReady)
  },
  ai: {
    status: () => ipcRenderer.invoke(IpcChannels.aiStatus),
    setKey: (key) => ipcRenderer.invoke(IpcChannels.aiSetKey, key),
    removeKey: () => ipcRenderer.invoke(IpcChannels.aiRemoveKey),
    testKey: () => ipcRenderer.invoke(IpcChannels.aiTestKey),
    run: (input) => ipcRenderer.invoke(IpcChannels.aiRun, input),
    cancel: () => ipcRenderer.invoke(IpcChannels.aiCancel)
  },
  updates: {
    check: () => ipcRenderer.invoke(IpcChannels.updateCheck),
    download: () => ipcRenderer.invoke(IpcChannels.updateDownload),
    install: () => ipcRenderer.invoke(IpcChannels.updateInstall),
    onStatus: (cb) => {
      const listener = (_e: IpcRendererEvent, s: UpdateStatus) => cb(s)
      ipcRenderer.on(IpcChannels.updateStatus, listener)
      return () => ipcRenderer.removeListener(IpcChannels.updateStatus, listener)
    }
  },
  onDbChanged: (cb) => {
    const listener = () => cb()
    ipcRenderer.on(IpcChannels.dbChanged, listener)
    return () => ipcRenderer.removeListener(IpcChannels.dbChanged, listener)
  },
  onMenuAction: (cb) => {
    const listener = (_e: IpcRendererEvent, action: MenuAction) => cb(action)
    ipcRenderer.on(IpcChannels.menuAction, listener)
    return () => ipcRenderer.removeListener(IpcChannels.menuAction, listener)
  }
}

contextBridge.exposeInMainWorld('docforge', api)
