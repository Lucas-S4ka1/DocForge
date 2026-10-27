/**
 * DOCX-Export mit der Bibliothek "docx". Bildet die Vorlagen in Word-tauglicher
 * Form nach (Word kennt die App-Schriften nicht → Standardschriften je Schriftpaar).
 */
import { nativeImage } from 'electron'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type IParagraphOptions
} from 'docx'
import { docFonts, marginMm, type CoverContent, type CvContent, type DocContent, type FreeContent, type LetterContent } from '@shared/document'

const MM = 56.7 // Twips pro Millimeter
const GRAY = '666666'
const noBorders = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
}

const hex = (c: string) => c.replace('#', '').toUpperCase()
const lines = (s: string) => s.split('\n')
const p = (text: string, opts: { bold?: boolean; size?: number; color?: string; italics?: boolean; caps?: boolean } = {}, para: IParagraphOptions = {}) =>
  new Paragraph({ ...para, children: [new TextRun({ text, bold: opts.bold, size: opts.size, color: opts.color, italics: opts.italics, allCaps: opts.caps })] })

/** Foto laden und auf Zielbreite (mm) skalieren. */
function photoRun(photosDir: string, file: string | null, widthMm: number): ImageRun | null {
  if (!file || !/^[A-Za-z0-9._-]+$/.test(file)) return null
  const full = join(photosDir, file)
  if (!existsSync(full)) return null
  const img = nativeImage.createFromPath(full)
  const { width, height } = img.getSize()
  if (!width || !height) return null
  const w = Math.round((widthMm / 25.4) * 96)
  // 3:4-Zuschnitt wie in der Vorschau (Bild wird ggf. verzerrungsfrei skaliert)
  const h = Math.round(w * (height / width))
  return new ImageRun({ type: file.endsWith('.png') ? 'png' : 'jpg', data: readFileSync(full), transformation: { width: w, height: h } })
}

function sectionHeading(title: string, accent: string): Paragraph {
  return new Paragraph({
    spacing: { before: 280, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC', space: 2 } },
    children: [new TextRun({ text: title, bold: true, allCaps: true, color: accent, size: 20, characterSpacing: 30 })]
  })
}

function buildCv(c: CvContent, photosDir: string) {
  const accent = hex(c.style.accent)
  const out: (Paragraph | Table)[] = []
  const contact = [c.personal.address, c.personal.city, c.personal.phone, c.personal.email, c.personal.website].filter(Boolean).join(' · ')
  const headText = [
    p(c.personal.name, { bold: true, size: 44 }),
    p(c.personal.headline, { color: accent, size: 22, caps: true }, { spacing: { after: 80 } }),
    p(contact, { color: GRAY, size: 17 }),
    ...(c.personal.birthDate ? [p(c.personal.birthDate, { color: GRAY, size: 17 })] : [])
  ]
  const photo = c.style.photoPosition !== 'none' ? photoRun(photosDir, c.style.photo, 32) : null
  if (photo) {
    const textCell = new TableCell({ children: headText, width: { size: 75, type: WidthType.PERCENTAGE } })
    const photoCell = new TableCell({ children: [new Paragraph({ alignment: c.style.photoPosition === 'left' ? AlignmentType.LEFT : AlignmentType.RIGHT, children: [photo] })], width: { size: 25, type: WidthType.PERCENTAGE } })
    out.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: noBorders,
        rows: [new TableRow({ children: c.style.photoPosition === 'left' ? [photoCell, textCell] : [textCell, photoCell] })]
      })
    )
  } else out.push(...headText)

  for (const s of c.sections.filter((x) => x.visible)) {
    // Leere Abschnitte wie in der Vorschau weglassen
    const hasContent = s.text.trim() || s.entries.some((e) => e.title || e.org || e.description) || s.items.some((i) => i.name)
    if (!hasContent) continue
    out.push(sectionHeading(s.title, accent))
    if (s.text.trim()) for (const para of s.text.split(/\n\s*\n/)) out.push(p(para.trim(), { size: 19 }, { spacing: { after: 100 } }))
    const entries = s.entries.filter((e) => e.title || e.org || e.description)
    // Leere Tabellen sind in Word ungültig → nur mit mindestens einem Eintrag
    if (entries.length) {
      out.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: noBorders,
          rows: entries
            .map(
              (e) =>
                new TableRow({
                  children: [
                    new TableCell({ width: { size: 22, type: WidthType.PERCENTAGE }, children: [p([e.start, e.end].filter(Boolean).join(' – '), { color: GRAY, size: 17 })] }),
                    new TableCell({
                      width: { size: 78, type: WidthType.PERCENTAGE },
                      children: [
                        p(e.title, { bold: true, size: 19 }),
                        ...(e.org || e.location ? [p([e.org, e.location].filter(Boolean).join(', '), { color: GRAY, size: 17 })] : []),
                        ...lines(e.description).filter((l) => l.trim()).map((l) => p(l.trim(), { size: 18 })),
                        new Paragraph({ spacing: { after: 100 }, children: [] })
                      ]
                    })
                  ]
                })
            )
        })
      )
    }
    if (s.items.length) {
      const text = s.items.filter((i) => i.name).map((i) => (i.level ? `${i.name} (${i.level})` : i.name)).join('  ·  ')
      if (text) out.push(p(text, { size: 19 }))
    }
  }
  if (c.signature.show) {
    out.push(new Paragraph({ spacing: { before: 600 }, children: [] }))
    out.push(p([c.signature.place, c.signature.date].filter(Boolean).join(', '), { size: 19 }))
    out.push(p('_______________________________', { color: GRAY }, { spacing: { before: 400 } }))
    out.push(p(c.personal.name, { size: 18, color: GRAY }))
  }
  return out
}

function buildLetter(c: LetterContent) {
  const accent = hex(c.style.accent)
  const right = { alignment: AlignmentType.RIGHT }
  return [
    p(c.sender.name, { bold: true, size: 24, color: accent }, right),
    ...[c.sender.street, c.sender.city, c.sender.phone, c.sender.email].filter(Boolean).map((l) => p(l, { size: 18, color: GRAY }, right)),
    // Rücksendeangabe + Anschriftfeld (DIN 5008)
    p([c.sender.name, c.sender.street, c.sender.city].filter(Boolean).join(' · '), { size: 14, color: GRAY }, { spacing: { before: 500 } }),
    ...[c.recipient.company, c.recipient.contact, c.recipient.street, c.recipient.city].filter(Boolean).map((l) => p(l, { size: 22 })),
    p([c.place, c.date].filter(Boolean).join(', '), { size: 22 }, { alignment: AlignmentType.RIGHT, spacing: { before: 500 } }),
    ...(c.reference ? [p(c.reference, { size: 18, color: GRAY }, { spacing: { before: 200 } })] : []),
    p(c.subject, { bold: true, size: 22 }, { spacing: { before: 400, after: 300 } }),
    p(c.salutation, { size: 22 }, { spacing: { after: 200 } }),
    ...c.body.split(/\n\s*\n/).map((para) => p(para.trim(), { size: 22 }, { spacing: { after: 200 } })),
    p(c.closing, { size: 22 }, { spacing: { before: 100, after: 700 } }),
    p(c.signatureName, { size: 22 }),
    ...(c.attachments.trim() ? [p('Anlagen', { bold: true, size: 20 }, { spacing: { before: 400 } }), ...c.attachments.split(/[,\n]/).filter((x) => x.trim()).map((a) => p(a.trim(), { size: 20 }))] : [])
  ]
}

function buildCover(c: CoverContent, photosDir: string) {
  const accent = hex(c.style.accent)
  const center = { alignment: AlignmentType.CENTER }
  const photo = c.style.photoPosition !== 'none' ? photoRun(photosDir, c.style.photo, 55) : null
  return [
    p(c.title, { bold: true, size: 72, color: accent }, { ...center, spacing: { before: 1200 } }),
    p(c.subtitle, { size: 28 }, center),
    ...(c.company ? [p(c.company, { size: 24, color: GRAY }, { ...center, spacing: { before: 120 } })] : []),
    ...(photo ? [new Paragraph({ ...center, spacing: { before: 600, after: 600 }, children: [photo] })] : [new Paragraph({ spacing: { before: 1600 }, children: [] })]),
    p(c.name, { bold: true, size: 30 }, center),
    ...lines(c.contact).filter(Boolean).map((l) => p(l, { size: 20, color: GRAY }, center)),
    ...(c.attachments.trim() ? [p('Anlagen', { bold: true, size: 20, color: accent }, { ...center, spacing: { before: 600 } }), ...lines(c.attachments).filter(Boolean).map((l) => p(l, { size: 20 }, center))] : [])
  ]
}

function buildFree(c: FreeContent) {
  const accent = hex(c.style.accent)
  const out: Paragraph[] = []
  if (c.title) out.push(p(c.title, { bold: true, size: 36, color: accent }, { spacing: { after: 300 } }))
  for (const block of c.body.split(/\n\s*\n/)) {
    for (const line of lines(block)) {
      const l = line.trim()
      if (!l) continue
      if (l.startsWith('# ')) out.push(sectionHeading(l.slice(2), accent))
      else if (l.startsWith('- ')) out.push(p(l.slice(2), { size: 21 }, { bullet: { level: 0 } }))
      else out.push(p(l, { size: 21 }, { spacing: { after: 120 } }))
    }
  }
  return out
}

export async function buildDocx(content: DocContent, photosDir: string): Promise<Buffer> {
  const m = content.kind === 'letter' ? { top: 20, right: 20, bottom: 20, left: 25 } : marginMm[content.style.margins]
  const children =
    content.kind === 'cv' ? buildCv(content, photosDir) : content.kind === 'letter' ? buildLetter(content) : content.kind === 'cover' ? buildCover(content, photosDir) : buildFree(content)
  const doc = new Document({
    creator: 'DocForge',
    styles: { default: { document: { run: { font: docFonts[content.style.font].docx } } } },
    sections: [
      {
        properties: { page: { size: { width: 210 * MM, height: 297 * MM }, margin: { top: m.top * MM, right: m.right * MM, bottom: m.bottom * MM, left: m.left * MM } } },
        children
      }
    ]
  })
  return Packer.toBuffer(doc)
}
