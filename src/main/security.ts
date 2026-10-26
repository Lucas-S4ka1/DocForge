/**
 * Sicherheits-Härtung für alle Fenster:
 * - keine Navigation weg von der App, keine neuen Fenster
 * - externe Links öffnen im System-Browser (nur https)
 * - Berechtigungen standardmäßig verweigert; nur Kamera ("media", Video) wird erlaubt –
 *   die tatsächliche Freigabe passiert erst, wenn der Nutzer im Kamera-Studio klickt.
 */
import { session, shell, type WebContents } from 'electron'

export function hardenSession(): void {
  const ses = session.defaultSession

  ses.setPermissionRequestHandler((_wc, permission, callback, details) => {
    if (permission === 'media') {
      const types = (details as { mediaTypes?: string[] }).mediaTypes ?? []
      // Nur Video – kein Mikrofon
      callback(types.length > 0 && types.every((t) => t === 'video'))
      return
    }
    callback(false)
  })

  ses.setPermissionCheckHandler((_wc, permission) => permission === 'media')
}

export function hardenWebContents(contents: WebContents, isAllowedUrl: (url: string) => boolean): void {
  contents.on('will-navigate', (event, url) => {
    if (!isAllowedUrl(url)) event.preventDefault()
  })
  contents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  contents.on('will-attach-webview', (event) => event.preventDefault())
}
