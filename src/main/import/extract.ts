/**
 * Text (und ggf. Bewerbungsfoto) aus vorhandenen Dokumenten lesen – Word (.docx), PDF, Text.
 * Läuft lokal; die Datei selbst wird nicht verändert und nicht kopiert.
 */
import { readFileSync, statSync } from 'node:fs'
import { extname } from 'node:path'
import { nativeImage } from 'electron'
import mammoth from 'mammoth'
import { DbError } from '../db/errors'

export interface ExtractedPhoto {
  data: Uint8Array
  format: 'png' | 'jpeg'
  width: number
  height: number
}

export interface Extracted {
  text: string
  photo: ExtractedPhoto | null
}

export const importExtensions = ['docx', 'pdf', 'txt']
const MAX_BYTES = 25 * 1024 * 1024
const MAX_CHARS = 200_000

export async function extractFile(path: string): Promise<Extracted> {
  const ext = extname(path).toLowerCase().slice(1)
  if (ext === 'doc') throw new DbError('VALIDATION', 'IMPORT_DOC')
  if (!importExtensions.includes(ext)) throw new DbError('VALIDATION', 'IMPORT_TYPE')
  if (statSync(path).size > MAX_BYTES) throw new DbError('VALIDATION', 'IMPORT_SIZE')
  const buf = readFileSync(path)

  let result: Extracted
  if (ext === 'docx') result = await fromDocx(buf)
  else if (ext === 'pdf') result = { text: await pdfText(buf), photo: null }
  else result = { text: buf.toString('utf8'), photo: null }

  const text = result.text.slice(0, MAX_CHARS)
  // Gescannte PDFs (nur Bilder) enthalten keinen lesbaren Text
  if (text.replace(/\s/g, '').length < 20) throw new DbError('VALIDATION', 'IMPORT_EMPTY')
  return { ...result, text }
}

async function fromDocx(buffer: Buffer): Promise<Extracted> {
  let text: string
  try {
    text = (await mammoth.extractRawText({ buffer })).value
  } catch {
    throw new DbError('VALIDATION', 'IMPORT_BROKEN')
  }
  // Bilder einsammeln, um ein Porträtfoto zu finden
  const images: Buffer[] = []
  await mammoth
    .convertToHtml(
      { buffer },
      {
        convertImage: mammoth.images.imgElement(async (img) => {
          if (/png|jpe?g/.test(img.contentType)) images.push(await img.readAsBuffer())
          return { src: '' }
        })
      }
    )
    .catch(() => undefined)
  return { text, photo: pickPortrait(images) }
}

/** Größtes Bild im Hochformat (Seitenverhältnis wie ein Bewerbungsfoto); Logos/Icons fallen raus. */
function pickPortrait(images: Buffer[]): ExtractedPhoto | null {
  let best: ExtractedPhoto | null = null
  for (const data of images) {
    if (data.length < 8 * 1024) continue
    const isPng = data.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    const isJpeg = data[0] === 0xff && data[1] === 0xd8
    if (!isPng && !isJpeg) continue
    const { width, height } = nativeImage.createFromBuffer(data).getSize()
    if (!width || !height || width < 120) continue
    const ratio = height / width
    if (ratio < 1.0 || ratio > 1.7) continue
    if (!best || width * height > best.width * best.height) best = { data: new Uint8Array(data), format: isPng ? 'png' : 'jpeg', width, height }
  }
  return best
}

interface PdfTextItem {
  str: string
  hasEOL: boolean
  transform: number[]
}

/** PDF-Text zeilenweise; größere Abstände zwischen Zeilen werden zu Leerzeilen (Absätze). */
export async function pdfText(buf: Buffer): Promise<string> {
  const { getDocumentProxy } = await import('unpdf')
  let pdf: Awaited<ReturnType<typeof getDocumentProxy>>
  try {
    pdf = await getDocumentProxy(new Uint8Array(buf))
  } catch {
    throw new DbError('VALIDATION', 'IMPORT_BROKEN')
  }
  const out: string[] = []
  for (let p = 1; p <= Math.min(pdf.numPages, 20); p++) {
    const page = await pdf.getPage(p)
    const items = (await page.getTextContent()).items as PdfTextItem[]
    let line = ''
    let lastY: number | null = null
    let lastSize = 10
    const flush = (y: number | null, size: number) => {
      if (line.trim()) {
        if (lastY !== null && y !== null && lastY - y > Math.max(size, lastSize) * 1.75) out.push('')
        out.push(line.trim())
        lastY = y
        lastSize = size
      }
      line = ''
    }
    let lineY: number | null = null
    let lineSize = 10
    for (const it of items) {
      if (typeof it.str !== 'string') continue
      const y = it.transform[5]
      const size = Math.abs(it.transform[3]) || 10
      // neue Zeile, wenn sich die Höhe deutlich ändert (Spalten/Tabellen ohne EOL-Markierung)
      if (line && lineY !== null && it.str && Math.abs(lineY - y) > size * 0.6) flush(lineY, lineSize)
      if (it.str) {
        if (!line) {
          lineY = y
          lineSize = size
        }
        line += it.str
      }
      if (it.hasEOL) flush(lineY, lineSize)
    }
    flush(lineY, lineSize)
    out.push('')
  }
  await pdf.cleanup?.()
  return out.join('\n')
}
