/**
 * Eigenes Protokoll "docforge-photo://<dateiname>" zum Anzeigen lokaler Fotos im Renderer.
 * Liefert ausschließlich Dateien aus dem Fotoordner (kein Zugriff auf andere Pfade).
 */
import { net, protocol } from 'electron'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { dataPaths } from './db/connection'

export const PHOTO_SCHEME = 'docforge-photo'

/** Muss VOR app.ready aufgerufen werden. */
export function registerPhotoScheme(): void {
  protocol.registerSchemesAsPrivileged([{ scheme: PHOTO_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } }])
}

export function registerPhotoProtocol(): void {
  protocol.handle(PHOTO_SCHEME, (req) => {
    const name = decodeURIComponent(new URL(req.url).hostname || new URL(req.url).pathname.replace(/^\/+/, ''))
    if (!/^[A-Za-z0-9._-]{1,200}$/.test(name) || name.startsWith('.')) return new Response('Bad request', { status: 400 })
    return net.fetch(pathToFileURL(join(dataPaths().photosDir, name)).toString())
  })
}
