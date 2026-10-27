/**
 * Personen-Segmentierung mit MediaPipe (Selfie Segmenter) – komplett lokal.
 * Modell und WebAssembly werden über "docforge-asset://" aus der App geladen, nie aus dem Netz.
 */
import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision'

const BASE = 'docforge-asset://mediapipe'

type Mode = 'VIDEO' | 'IMAGE'
const cache = new Map<Mode, Promise<ImageSegmenter>>()

async function create(mode: Mode): Promise<ImageSegmenter> {
  const fileset = await FilesetResolver.forVisionTasks(BASE)
  // Explizite Pfade: kein Nachladen der SIMD-losen Variante aus dem Netz
  fileset.wasmLoaderPath = `${BASE}/vision_wasm_internal.js`
  fileset.wasmBinaryPath = `${BASE}/vision_wasm_internal.wasm`
  const make = (delegate: 'GPU' | 'CPU') =>
    ImageSegmenter.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: `${BASE}/selfie_segmenter.tflite`, delegate },
      runningMode: mode,
      outputConfidenceMasks: true,
      outputCategoryMask: false
    })
  try {
    return await make('GPU')
  } catch {
    // Ältere Grafiktreiber: auf CPU ausweichen
    return make('CPU')
  }
}

export function getSegmenter(mode: Mode): Promise<ImageSegmenter> {
  let p = cache.get(mode)
  if (!p) {
    p = create(mode)
    cache.set(mode, p)
    p.catch(() => cache.delete(mode))
  }
  return p
}

/**
 * Schreibt die Personen-Maske (0…1) als Alphakanal in ein Canvas gleicher Größe.
 * Weiß = Person, transparent = Hintergrund.
 */
export function maskToCanvas(mask: Float32Array, w: number, h: number, target: HTMLCanvasElement): void {
  target.width = w
  target.height = h
  const ctx = target.getContext('2d')!
  const img = ctx.createImageData(w, h)
  const d = img.data
  for (let i = 0; i < mask.length; i++) {
    // Leichte Kontrastkurve → sauberere Kanten
    const a = Math.min(1, Math.max(0, (mask[i] - 0.25) / 0.5))
    const o = i * 4
    d[o] = d[o + 1] = d[o + 2] = 255
    d[o + 3] = a * 255
  }
  ctx.putImageData(img, 0, 0)
}

export function segmentVideo(seg: ImageSegmenter, source: HTMLCanvasElement, ts: number, target: HTMLCanvasElement): boolean {
  let ok = false
  seg.segmentForVideo(source, ts, (r) => {
    const m = r.confidenceMasks?.[0]
    if (m) {
      maskToCanvas(m.getAsFloat32Array(), m.width, m.height, target)
      ok = true
    }
  })
  return ok
}

export function segmentImage(seg: ImageSegmenter, source: HTMLCanvasElement, target: HTMLCanvasElement): boolean {
  let ok = false
  seg.segment(source, (r) => {
    const m = r.confidenceMasks?.[0]
    if (m) {
      maskToCanvas(m.getAsFloat32Array(), m.width, m.height, target)
      ok = true
    }
  })
  return ok
}
