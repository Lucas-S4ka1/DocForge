/**
 * Anwendungsmenü (zweisprachig). Menüaktionen werden per IPC an den Renderer geschickt.
 */
import { app, BrowserWindow, Menu, type MenuItemConstructorOptions } from 'electron'
import { IpcChannels, type MenuAction } from '@shared/ipc'
import type { Language } from '@shared/settings'

const labels = {
  de: {
    file: 'Datei',
    view: 'Ansicht',
    window: 'Fenster',
    help: 'Hilfe',
    about: 'Über DocForge',
    hub: 'Hub',
    editor: 'Editor',
    studio: 'Kamera-Studio',
    archive: 'Archiv',
    settings: 'Einstellungen …',
    quit: 'Beenden',
    newCv: 'Neuer Lebenslauf',
    newLetter: 'Neues Anschreiben'
  },
  en: {
    file: 'File',
    view: 'View',
    window: 'Window',
    help: 'Help',
    about: 'About DocForge',
    hub: 'Hub',
    editor: 'Editor',
    studio: 'Camera studio',
    archive: 'Archive',
    settings: 'Settings …',
    quit: 'Quit',
    newCv: 'New CV',
    newLetter: 'New cover letter'
  }
} as const

function send(action: MenuAction): void {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  win?.webContents.send(IpcChannels.menuAction, action)
}

export function buildMenu(lang: Language): void {
  const l = labels[lang]
  const isMac = process.platform === 'darwin'
  const isDev = !app.isPackaged

  const nav: MenuItemConstructorOptions[] = [
    { label: l.hub, accelerator: 'CmdOrCtrl+1', click: () => send('navigate:hub') },
    { label: l.editor, accelerator: 'CmdOrCtrl+2', click: () => send('navigate:editor') },
    { label: l.studio, accelerator: 'CmdOrCtrl+3', click: () => send('navigate:studio') },
    { label: l.archive, accelerator: 'CmdOrCtrl+4', click: () => send('navigate:archive') }
  ]

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { label: l.about, click: () => send('about') },
              { type: 'separator' },
              { label: l.settings, accelerator: 'Cmd+,', click: () => send('navigate:settings') },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit', label: l.quit }
            ]
          } as MenuItemConstructorOptions
        ]
      : []),
    {
      label: l.file,
      submenu: [
        { label: l.newCv, accelerator: 'CmdOrCtrl+N', click: () => send('new:cv') },
        { label: l.newLetter, accelerator: 'CmdOrCtrl+L', click: () => send('new:letter') },
        { type: 'separator' },
        ...(isMac ? [] : [{ label: l.settings, accelerator: 'Ctrl+,', click: () => send('navigate:settings') }]),
        ...(isMac ? [] : [{ type: 'separator' } as MenuItemConstructorOptions, { role: 'quit', label: l.quit } as MenuItemConstructorOptions])
      ]
    },
    { role: 'editMenu' },
    {
      label: l.view,
      submenu: [
        ...nav,
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        // Entwicklerwerkzeuge nur im Entwicklungsmodus
        ...(isDev ? [{ type: 'separator' } as MenuItemConstructorOptions, { role: 'reload' } as MenuItemConstructorOptions, { role: 'toggleDevTools' } as MenuItemConstructorOptions] : [])
      ]
    },
    { role: 'windowMenu', label: l.window },
    { label: l.help, submenu: [{ label: l.about, click: () => send('about') }] }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
