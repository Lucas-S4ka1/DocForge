/**
 * Preload – die einzige Brücke zwischen Renderer und Main-Process.
 * Stellt eine schmale, typisierte API unter `window.docforge` bereit.
 * Es wird nie `ipcRenderer` selbst durchgereicht.
 */
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IpcChannels, type DocForgeApi, type MenuAction } from '@shared/ipc'

const api: DocForgeApi = {
  app: {
    getInfo: () => ipcRenderer.invoke(IpcChannels.appInfo),
    openDataFolder: () => ipcRenderer.invoke(IpcChannels.openExternalDataFolder)
  },
  settings: {
    get: () => ipcRenderer.invoke(IpcChannels.settingsGet),
    set: (patch) => ipcRenderer.invoke(IpcChannels.settingsSet, patch)
  },
  onMenuAction: (cb) => {
    const listener = (_e: IpcRendererEvent, action: MenuAction) => cb(action)
    ipcRenderer.on(IpcChannels.menuAction, listener)
    return () => ipcRenderer.removeListener(IpcChannels.menuAction, listener)
  }
}

contextBridge.exposeInMainWorld('docforge', api)
