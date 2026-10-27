/**
 * Bildverarbeitung des Kamera-Studios (Vorschau und Aufnahme nutzen dieselben Funktionen):
 * Spiegeln, Zuschnitt, Hintergrund (weichzeichnen/ersetzen) und Anpassungen.
 */

export type BackgroundMode = 'original' | 'blur' | 'solid' | 'studio'
export type CropPreset = 'cv' | 'passport' | 'square'

export const cropAspect: Record<CropPreset, number> = {
  cv: 3 / 4,
  passport: 35 / 45,
  square: 1
}

export interface Adjustments {
  /** jeweils −50 … +50 */
  brightness: number
  contrast: number
  warmth: number
  /** 0 … 100 */
  sharpness: number
}

export const neutralAdjustments: Adjustments = { brightness: 0, contrast: 0, warmth: 0, sharpness: 0 }

/** Warmton als Farbtemperatur zur Anzeige (wärmer = niedriger Kelvin-Wert). */
export const warmthKelvin = (w: number) => Math.round((5500 - w * 30) / 100) * 100

/**
 * Zuschnitt-Rechteck (normiert 0…1) relativ zum Kamerabild:
 * zentriert, 88 % der Bildhöhe, Seitenverhältnis je Vorlage.
 */
export function cropRect(preset: CropPreset, frameW: number, frameH: number) {
  const aspect = cropAspect[preset]
  let h = frameH * 0.88
  let w = h * aspect
  if (w > frameW * 0.95) {
    w = frameW * 0.95
    h = w / aspect
  }
  return { x: (frameW - w) / 2, y: (frameH - h) / 2, w, h }
}

/**
 * SVG-Filter-Parameter für Helligkeit, Kontrast, Wärme, Schärfe.
 * Der Filter (#df-cam) liegt einmal im DOM und wird per CSS (Vorschau) bzw.
 * ctx.filter (Aufnahme) angewendet.
 */
export function filterParams(a: Adjustments) {
  const b = 1 + a.brightness / 100 // 0.5 … 1.5
  const c = 1 + a.contrast / 100
  const slope = b * c
  const intercept = 0.5 - 0.5 * c
  const wr = a.warmth / 250 // ±0.2
  const s = a.sharpness / 200 // 0 … 0.5
  return {
    slope: slope.toFixed(3),
    intercept: intercept.toFixed(3),
    matrix: `${(1 + wr).toFixed(3)} 0 0 0 0  0 1 0 0 0  0 0 ${(1 - wr).toFixed(3)} 0 0  0 0 0 1 0`,
    kernel: `0 ${-s} 0 ${-s} ${1 + 4 * s} ${-s} 0 ${-s} 0`
  }
}

export const isNeutral = (a: Adjustments) => a.brightness === 0 && a.contrast === 0 && a.warmth === 0 && a.sharpness === 0

/** Malt den Hintergrund (für Modus ≠ original). */
function paintBackground(ctx: CanvasRenderingContext2D, frame: CanvasImageSource, w: number, h: number, mode: BackgroundMode, color: string) {
  if (mode === 'blur') {
    ctx.save()
    ctx.filter = `blur(${Math.max(6, Math.round(h * 0.018))}px)`
    // etwas größer zeichnen, damit die Ränder beim Weichzeichnen nicht ausbleichen
    const pad = h * 0.04
    ctx.drawImage(frame, -pad, -pad, w + 2 * pad, h + 2 * pad)
    ctx.restore()
  } else if (mode === 'solid') {
    ctx.fillStyle = color
    ctx.fillRect(0, 0, w, h)
  } else {
    // Neutrales Studiograu mit leichtem Lichtverlauf
    const g = ctx.createRadialGradient(w * 0.5, h * 0.38, h * 0.05, w * 0.5, h * 0.5, Math.max(w, h) * 0.75)
    g.addColorStop(0, '#a3a5a8')
    g.addColorStop(1, '#6c6e72')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  }
}

/**
 * Setzt Person (laut Maske) vor den gewählten Hintergrund.
 * `frame` und `mask` haben dieselbe Bildfläche; Ergebnis landet in `out`.
 */
export function composite(
  out: HTMLCanvasElement,
  frame: HTMLCanvasElement,
  mask: HTMLCanvasElement | null,
  mode: BackgroundMode,
  color: string,
  scratch: HTMLCanvasElement
) {
  const w = frame.width
  const h = frame.height
  if (out.width !== w || out.height !== h) {
    out.width = w
    out.height = h
  }
  const ctx = out.getContext('2d')!
  if (mode === 'original' || !mask) {
    ctx.drawImage(frame, 0, 0)
    return
  }
  paintBackground(ctx, frame, w, h, mode, color)
  // Person freistellen: Bild zeichnen, mit (weich gezeichneter) Maske beschneiden
  scratch.width = w
  scratch.height = h
  const s = scratch.getContext('2d')!
  s.globalCompositeOperation = 'source-over'
  s.drawImage(frame, 0, 0)
  s.globalCompositeOperation = 'destination-in'
  s.filter = `blur(${Math.max(1, Math.round(h / 500))}px)`
  s.drawImage(mask, 0, 0, w, h)
  s.filter = 'none'
  s.globalCompositeOperation = 'source-over'
  ctx.drawImage(scratch, 0, 0)
}

/** Kopiert einen Bildausschnitt (optional gespiegelt) in ein Canvas. */
export function grab(
  source: CanvasImageSource,
  srcW: number,
  rect: { x: number; y: number; w: number; h: number },
  mirror: boolean,
  target: HTMLCanvasElement,
  scale = 1
) {
  const w = Math.round(rect.w * scale)
  const h = Math.round(rect.h * scale)
  target.width = w
  target.height = h
  const ctx = target.getContext('2d')!
  ctx.save()
  if (mirror) {
    // Spiegeln um die Bildmitte: Ausschnitt aus der gespiegelten Position nehmen
    ctx.translate(w, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(source, srcW - rect.x - rect.w, rect.y, rect.w, rect.h, 0, 0, w, h)
  } else {
    ctx.drawImage(source, rect.x, rect.y, rect.w, rect.h, 0, 0, w, h)
  }
  ctx.restore()
}
