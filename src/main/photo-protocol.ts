/**
 * Eigene Protokolle (nur lokale Dateien, kein Netz):
 * - "docforge-photo://<datei>"  → Fotos aus dem Fotoordner
 * - "docforge-asset://<pfad>"   → mitgelieferte Assets (MediaPipe-Modell + WebAssembly)
 */
import { app, net, protocol } from 'electron'
import { readFile } from 'node:fs/promises'
import { join, normalize, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { dataPaths } from './db/connection'

export const PHOTO_SCHEME = 'docforge-photo'
export const ASSET_SCHEME = 'docforge-asset'

/** Muss VOR app.ready aufgerufen werden (alle Schemes in EINEM Aufruf). */
export function registerPhotoScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: PHOTO_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
    { scheme: ASSET_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
  ])
}

/** Ordner der mitgelieferten Assets (Build: out/renderer, Entwicklung: src/renderer/public). */
function assetRoot(): string {
  return app.isPackaged || !process.env['ELECTRON_RENDERER_URL']
    ? join(__dirname, '../renderer')
    : join(app.getAppPath(), 'src/renderer/public')
}

const mime: Record<string, string> = {
  wasm: 'application/wasm',
  js: 'text/javascript',
  tflite: 'application/octet-stream'
}

export function registerPhotoProtocol(): void {
  protocol.handle(PHOTO_SCHEME, (req) => {
    const name = decodeURIComponent(new URL(req.url).hostname || new URL(req.url).pathname.replace(/^\/+/, ''))
    if (!/^[A-Za-z0-9._-]{1,200}$/.test(name) || name.startsWith('.')) return new Response('Bad request', { status: 400 })
    return net.fetch(pathToFileURL(join(dataPaths().photosDir, name)).toString())
  })

  protocol.handle(ASSET_SCHEME, async (req) => {
    const url = new URL(req.url)
    const rel = decodeURIComponent(`${url.hostname}${url.pathname}`)
    // Nur Dateien unterhalb des Asset-Ordners, nur bekannte Typen
    const root = assetRoot()
    const full = normalize(join(root, rel))
    const ext = rel.split('.').pop() ?? ''
    if (!full.startsWith(root + sep) || !(ext in mime)) return new Response('Not found', { status: 404 })
    try {
      const data = await readFile(full)
      return new Response(data, { headers: { 'content-type': mime[ext], 'access-control-allow-origin': '*' } })
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })
}
