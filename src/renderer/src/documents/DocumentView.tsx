/**
 * Rendert ein Dokument (Lebenslauf, Anschreiben, Deckblatt, freies Dokument) auf weißem A4-Papier.
 * Wird identisch für die Editor-Vorschau, die Vorlagen-Thumbnails und den PDF-Druck verwendet.
 */
import type { CSSProperties, ReactNode } from 'react'
import {
  docFonts,
  marginMm,
  type CoverContent,
  type CvContent,
  type CvSection,
  type DocContent,
  type DocStyle,
  type FreeContent,
  type LetterContent
} from '@shared/document'
import './doc.css'

export type ViewMode = 'preview' | 'print' | 'thumb'

/** Seitenränder je Dokument (Briefe nach DIN 5008: links 25 mm, rechts 20 mm). */
export function pageMargins(content: DocContent) {
  if (content.kind === 'letter') return { top: 10, right: 20, bottom: 18, left: 25 }
  return marginMm[content.style.margins]
}

function cssVars(content: DocContent): CSSProperties {
  const m = pageMargins(content)
  const f = docFonts[content.style.font] ?? docFonts.barlow
  return {
    ['--acc' as string]: content.style.accent,
    ['--fh' as string]: `${f.heading}, Arial, sans-serif`,
    ['--fb' as string]: `${f.body}, Arial, sans-serif`,
    ['--mt' as string]: `${m.top}mm`,
    ['--mr' as string]: `${m.right}mm`,
    ['--mb' as string]: `${m.bottom}mm`,
    ['--ml' as string]: `${m.left}mm`
  }
}

export function DocumentView({ content, mode, lang = 'de' }: { content: DocContent; mode: ViewMode; lang?: 'de' | 'en' }) {
  let body: ReactNode
  switch (content.kind) {
    case 'cv':
      body = <CvView c={content} mode={mode} lang={lang} />
      break
    case 'letter':
      body = <LetterView c={content} lang={lang} />
      break
    case 'cover':
      body = <CoverView c={content} mode={mode} lang={lang} />
      break
    default:
      body = <FreeView c={content} />
  }
  return (
    <div className={`df-doc ${mode === 'print' ? 'df-print' : ''}`} style={cssVars(content)}>
      <div className="df-sheet">{body}</div>
    </div>
  )
}

// ── Bausteine ───────────────────────────────────────────────────────────────

function Photo({ style, mode, label }: { style: DocStyle; mode: ViewMode; label: string }) {
  if (style.photoPosition === 'none') return null
  if (style.photo) return <img className="df-photo" src={`docforge-photo://${encodeURIComponent(style.photo)}`} alt="" />
  // Platzhalter nur in der Vorschau, nie im PDF
  return mode === 'print' ? null : <div className="df-photo-ph">{label}</div>
}

const join = (...parts: (string | undefined | null)[]) => parts.filter((x) => x && x.trim()).join(' · ')

function Section({ s }: { s: CvSection }) {
  const entries = s.entries.filter((e) => e.title || e.org || e.description)
  const items = s.items.filter((i) => i.name)
  if (!s.text.trim() && entries.length === 0 && items.length === 0) return null
  return (
    <section className="df-sec">
      <h2 className="df-sec-title">{s.title}</h2>
      <div>
        {s.text.trim() && <p className="df-pre">{s.text.trim()}</p>}
        {entries.map((e) => (
          <div key={e.id} className="df-entry">
            <div className="df-entry-date">{[e.start, e.end].filter(Boolean).join(' – ')}</div>
            <div>
              <div className="df-entry-title">{e.title}</div>
              {(e.org || e.location) && <div className="df-entry-org">{[e.org, e.location].filter(Boolean).join(', ')}</div>}
              {e.description.trim() && <div className="df-entry-desc">{e.description.trim()}</div>}
            </div>
          </div>
        ))}
        {items.length > 0 && (
          <div className="df-items">
            {items.map((i) => (
              <span key={i.id}>
                {i.name}
                {i.level && <span className="df-item-level"> ({i.level})</span>}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function Signature({ c }: { c: CvContent }) {
  if (!c.signature.show) return null
  return (
    <div className="df-signature">
      <p>{[c.signature.place, c.signature.date].filter(Boolean).join(', ')}</p>
      <div className="df-signature-line">{c.personal.name}</div>
    </div>
  )
}

// ── Lebenslauf ─────────────────────────────────────────────────────────────

function CvView({ c, mode, lang }: { c: CvContent; mode: ViewMode; lang: 'de' | 'en' }) {
  const visible = c.sections.filter((s) => s.visible)
  const pp = c.style.photoPosition
  const photo = <Photo style={c.style} mode={mode} label={lang === 'de' ? 'Foto 3:4' : 'Photo 3:4'} />
  const contact = join(c.personal.address, c.personal.city, c.personal.phone, c.personal.email, c.personal.website)
  const birth = c.personal.birthDate ? `${lang === 'de' ? 'geb.' : 'born'} ${c.personal.birthDate}` : ''

  switch (c.style.template) {
    case 'twocolumn': {
      const sideKinds = ['skills', 'languages', 'interests']
      return (
        <div className="cv-twocolumn">
          <aside className="side">
            {photo}
            <section className="df-sec" style={{ marginTop: 0 }}>
              <h2 className="df-sec-title">{lang === 'de' ? 'Kontakt' : 'Contact'}</h2>
              <div className="contact-list">
                {[c.personal.address, c.personal.city, c.personal.phone, c.personal.email, c.personal.website, birth].filter(Boolean).map((l) => (
                  <span key={l}>{l}</span>
                ))}
              </div>
            </section>
            {visible.filter((s) => sideKinds.includes(s.kind)).map((s) => (
              <Section key={s.id} s={s} />
            ))}
          </aside>
          <div>
            <h1 className="name">{c.personal.name}</h1>
            <p className="headline">{c.personal.headline}</p>
            {visible.filter((s) => !sideKinds.includes(s.kind)).map((s) => (
              <Section key={s.id} s={s} />
            ))}
            <Signature c={c} />
          </div>
        </div>
      )
    }
    case 'modern':
      return (
        <div className="cv-modern">
          <header className={`band ${pp === 'left' ? 'photo-left' : ''}`}>
            <div style={{ flex: 1 }}>
              <h1 className="name">{c.personal.name}</h1>
              <p className="headline">{c.personal.headline}</p>
              <p className="contact">{join(contact, birth)}</p>
            </div>
            {photo}
          </header>
          {visible.map((s) => (
            <Section key={s.id} s={s} />
          ))}
          <Signature c={c} />
        </div>
      )
    case 'minimal':
      return (
        <div className="cv-minimal">
          <header className="head">
            {photo}
            <h1 className="name">{c.personal.name}</h1>
            <p className="headline">{c.personal.headline}</p>
            <p className="contact">{join(contact, birth)}</p>
          </header>
          {visible.map((s) => (
            <Section key={s.id} s={s} />
          ))}
          <Signature c={c} />
        </div>
      )
    default:
      return (
        <div className="cv-classic">
          <header className={`head ${pp === 'left' ? 'photo-left' : ''}`}>
            <div style={{ flex: 1 }}>
              <h1 className="name">{c.personal.name}</h1>
              <p className="headline">{c.personal.headline}</p>
              <p className="contact">{join(contact, birth)}</p>
            </div>
            {photo}
          </header>
          {visible.map((s) => (
            <Section key={s.id} s={s} />
          ))}
          <Signature c={c} />
        </div>
      )
  }
}

// ── Anschreiben (DIN 5008, Form A/B + Modern) ──────────────────────────────

function LetterView({ c, lang }: { c: LetterContent; lang: 'de' | 'en' }) {
  const tpl = ['din-a', 'din-b', 'modern-letter'].includes(c.style.template) ? c.style.template : 'din-b'
  const s = c.sender
  return (
    <div className={`letter ${tpl}`}>
      <header className="lhead">
        <div className="sname">{s.name}</div>
        {[s.street, s.city].filter(Boolean).length > 0 && <div className="sline">{join(s.street, s.city)}</div>}
        {(s.phone || s.email) && <div className="sline">{join(s.phone, s.email)}</div>}
      </header>
      <div className="addr-row">
        <div className="addr">
          <div className="return">{join(s.name, s.street, s.city)}</div>
          {[c.recipient.company, c.recipient.contact, c.recipient.street, c.recipient.city].filter(Boolean).map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      </div>
      <p className="date">{[c.place, c.date].filter(Boolean).join(', ')}</p>
      {c.reference && <p className="ref">{c.reference}</p>}
      <p className="subject">{c.subject}</p>
      <p style={{ marginBottom: '4.2mm' }}>{c.salutation}</p>
      <div className="body">
        {c.body
          .split(/\n\s*\n/)
          .filter((x) => x.trim())
          .map((para, i) => (
            <p key={i} className="df-pre">
              {para.trim()}
            </p>
          ))}
      </div>
      <p className="closing">{c.closing}</p>
      <p className="signame">{c.signatureName}</p>
      {c.attachments.trim() && (
        <div className="attach">
          <strong>{lang === 'de' ? 'Anlagen' : 'Enclosures'}</strong>
          {c.attachments
            .split(/[,\n]/)
            .map((a) => a.trim())
            .filter(Boolean)
            .join(', ')}
        </div>
      )}
    </div>
  )
}

// ── Deckblatt ──────────────────────────────────────────────────────────────

function CoverView({ c, mode, lang }: { c: CoverContent; mode: ViewMode; lang: 'de' | 'en' }) {
  return (
    <div className={`cover ${c.style.template === 'cover-modern' ? 'cover-modern' : ''}`}>
      <h1 className="ctitle">{c.title}</h1>
      <p className="csub">{c.subtitle}</p>
      {c.company && <p className="ccompany">{c.company}</p>}
      <Photo style={c.style} mode={mode} label={lang === 'de' ? 'Foto' : 'Photo'} />
      <p className="cname">{c.name}</p>
      <p className="ccontact">{c.contact}</p>
      {c.attachments.trim() && (
        <div className="cattach">
          <strong>{lang === 'de' ? 'Anlagen' : 'Enclosures'}</strong>
          {c.attachments}
        </div>
      )}
    </div>
  )
}

// ── Freies Dokument ────────────────────────────────────────────────────────

function FreeView({ c }: { c: FreeContent }) {
  const blocks: ReactNode[] = []
  let list: string[] = []
  const flush = () => {
    if (list.length) blocks.push(<ul key={`ul${blocks.length}`}>{list.map((l, i) => <li key={i}>{l}</li>)}</ul>)
    list = []
  }
  for (const raw of c.body.split('\n')) {
    const l = raw.trim()
    if (l.startsWith('- ')) {
      list.push(l.slice(2))
      continue
    }
    flush()
    if (!l) continue
    if (l.startsWith('# ')) blocks.push(<h2 key={blocks.length} className="df-sec-title" style={{ marginTop: '5mm' }}>{l.slice(2)}</h2>)
    else blocks.push(<p key={blocks.length}>{l}</p>)
  }
  flush()
  return (
    <div className="free">
      {c.title && <h1 className="ftitle">{c.title}</h1>}
      {blocks}
    </div>
  )
}
