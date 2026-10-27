/**
 * Rechte Spalte, Reiter "Inhalt": Formulare für den ausgewählten Teil des Dokuments.
 * Jede Eingabe ändert die Arbeitskopie sofort (Vorschau live), gespeichert wird automatisch.
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  emptyEntry,
  emptyItem,
  type CoverContent,
  type CvContent,
  type CvEntry,
  type CvSection,
  type DocContent,
  type FreeContent,
  type LetterContent
} from '@shared/document'
import { useEditor } from '@/store/editor'
import { db } from '@/store/db'
import { toast } from '@/store/toast'

// ── Kompakte Felder ─────────────────────────────────────────────────────────

function F({ label, value, onChange, placeholder, wide }: { label: string; value: string; onChange(v: string): void; placeholder?: string; wide?: boolean }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1 ${wide ? 'col-span-2' : ''}`}>
      <span className="text-[11.5px] text-accent-300">{label}</span>
      <input className="input min-h-[32px] py-1 text-[13px]" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

function A({ label, value, onChange, rows = 4, placeholder }: { label: string; value: string; onChange(v: string): void; rows?: number; placeholder?: string }) {
  return (
    <label className="col-span-2 flex flex-col gap-1">
      <span className="text-[11.5px] text-accent-300">{label}</span>
      <textarea className="input min-h-0 resize-y py-1.5 text-[13px] leading-snug" rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-2.5">{children}</div>
}

function Head({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="sys-label text-accent-400">{children}</span>
      {aside && <span className="ml-auto flex gap-1.5">{aside}</span>}
    </div>
  )
}

const small = 'btn px-2 py-0.5 text-[11.5px]'

/** Typsichere Bearbeitung eines bestimmten Inhaltstyps. */
function useEdit<T extends DocContent>() {
  const edit = useEditor((s) => s.edit)
  return (fn: (c: T) => void) => edit((c) => fn(c as T))
}

// ── Lebenslauf ──────────────────────────────────────────────────────────────

function PersonalForm({ c }: { c: CvContent }) {
  const { t } = useTranslation()
  const edit = useEdit<CvContent>()
  const doc = useEditor((s) => s.doc)!
  const set = (k: keyof CvContent['personal']) => (v: string) => edit((x) => void (x.personal[k] = v))
  const fromProfile = async () => {
    const p = await db.profiles.get(doc.profileId)
    edit((x) => {
      x.personal = { ...x.personal, name: p.name, headline: p.headline ?? '', email: p.email ?? '', phone: p.phone ?? '', address: p.address ?? '', city: p.city ?? '' }
    })
    toast.info(t('editor.fromProfileDone'))
  }
  return (
    <>
      <Head aside={<button type="button" className={small} onClick={fromProfile}>{t('editor.fromProfile')}</button>}>{t('editor.personal')}</Head>
      <Grid>
        <F wide label={t('fields.name')} value={c.personal.name} onChange={set('name')} />
        <F wide label={t('fields.headline')} value={c.personal.headline} onChange={set('headline')} />
        <F label={t('fields.email')} value={c.personal.email} onChange={set('email')} />
        <F label={t('fields.phone')} value={c.personal.phone} onChange={set('phone')} />
        <F label={t('fields.address')} value={c.personal.address} onChange={set('address')} />
        <F label={t('editor.zipCity')} value={c.personal.city} onChange={set('city')} />
        <F label={t('fields.birthDate')} value={c.personal.birthDate} onChange={set('birthDate')} placeholder="01.01.1990" />
        <F label={t('fields.website')} value={c.personal.website} onChange={set('website')} />
      </Grid>
      <Head>{t('editor.signature')}</Head>
      <label className="flex items-center gap-2 text-[13px] text-accent-200">
        <input type="checkbox" checked={c.signature.show} onChange={(e) => edit((x) => void (x.signature.show = e.target.checked))} />
        {t('editor.showSignature')}
      </label>
      {c.signature.show && (
        <Grid>
          <F label={t('editor.place')} value={c.signature.place} onChange={(v) => edit((x) => void (x.signature.place = v))} />
          <F label={t('editor.date')} value={c.signature.date} onChange={(v) => edit((x) => void (x.signature.date = v))} />
        </Grid>
      )}
    </>
  )
}

function EntryCard({ e, index, total, onChange, onMove, onRemove }: { e: CvEntry; index: number; total: number; onChange(k: keyof CvEntry, v: string): void; onMove(d: -1 | 1): void; onRemove(): void }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-2 border border-line p-2.5">
      <div className="flex items-center gap-1.5">
        <span className="truncate text-[12px] text-accent-300">{e.title || e.org || `#${index + 1}`}</span>
        <span className="ml-auto flex gap-1">
          <button type="button" className={small} disabled={index === 0} onClick={() => onMove(-1)} aria-label="↑">↑</button>
          <button type="button" className={small} disabled={index === total - 1} onClick={() => onMove(1)} aria-label="↓">↓</button>
          <button type="button" className={`${small} hover:text-danger`} onClick={onRemove} aria-label={t('common.delete')}>×</button>
        </span>
      </div>
      <Grid>
        <F wide label={t('editor.entryTitle')} value={e.title} onChange={(v) => onChange('title', v)} />
        <F label={t('editor.entryOrg')} value={e.org} onChange={(v) => onChange('org', v)} />
        <F label={t('fields.location')} value={e.location} onChange={(v) => onChange('location', v)} />
        <F label={t('editor.from')} value={e.start} onChange={(v) => onChange('start', v)} placeholder="03/2021" />
        <F label={t('editor.to')} value={e.end} onChange={(v) => onChange('end', v)} placeholder={t('editor.today')} />
        <A label={t('editor.description')} value={e.description} rows={3} onChange={(v) => onChange('description', v)} />
      </Grid>
    </div>
  )
}

function SectionForm({ s }: { s: CvSection }) {
  const { t } = useTranslation()
  const edit = useEdit<CvContent>()
  const select = useEditor((x) => x.select)
  const upd = (fn: (sec: CvSection) => void) => edit((c) => fn(c.sections.find((x) => x.id === s.id)!))
  const usesEntries = ['experience', 'education', 'certificates', 'custom'].includes(s.kind)
  const usesItems = ['skills', 'languages', 'interests'].includes(s.kind)
  const usesText = s.kind === 'profile' || s.kind === 'custom'

  return (
    <>
      <Head
        aside={
          <button
            type="button"
            className={`${small} hover:text-danger`}
            onClick={() => {
              edit((c) => void (c.sections = c.sections.filter((x) => x.id !== s.id)))
              select('personal')
            }}
          >
            {t('editor.removeSection')}
          </button>
        }
      >
        {t(`editor.kinds.${s.kind}`)}
      </Head>
      <Grid>
        <F wide label={t('editor.sectionTitle')} value={s.title} onChange={(v) => upd((x) => void (x.title = v))} />
      </Grid>
      <label className="flex items-center gap-2 text-[13px] text-accent-200">
        <input type="checkbox" checked={s.visible} onChange={(e) => upd((x) => void (x.visible = e.target.checked))} />
        {t('editor.visible')}
      </label>
      {usesText && (
        <Grid>
          <A label={t('editor.text')} value={s.text} rows={s.kind === 'profile' ? 6 : 4} onChange={(v) => upd((x) => void (x.text = v))} placeholder={s.kind === 'profile' ? t('editor.profileHint') : ''} />
        </Grid>
      )}
      {usesEntries && (
        <div className="flex flex-col gap-2">
          {s.entries.map((e, i) => (
            <EntryCard
              key={e.id}
              e={e}
              index={i}
              total={s.entries.length}
              onChange={(k, v) => upd((x) => void ((x.entries[i] as unknown as Record<string, string>)[k] = v))}
              onMove={(d) =>
                upd((x) => {
                  const [m] = x.entries.splice(i, 1)
                  x.entries.splice(i + d, 0, m)
                })
              }
              onRemove={() => upd((x) => void x.entries.splice(i, 1))}
            />
          ))}
          <button type="button" className="btn border-dashed text-[12.5px] text-accent-300" onClick={() => upd((x) => void x.entries.push(emptyEntry()))}>
            + {t('editor.addEntry')}
          </button>
        </div>
      )}
      {usesItems && (
        <div className="flex flex-col gap-1.5">
          {s.items.map((it, i) => (
            <div key={it.id} className="flex gap-1.5">
              <input className="input min-h-[32px] flex-[3] py-1 text-[13px]" placeholder={t('editor.itemName')} value={it.name} onChange={(e) => upd((x) => void (x.items[i].name = e.target.value))} />
              <input className="input min-h-[32px] flex-[2] py-1 text-[13px]" placeholder={t(s.kind === 'languages' ? 'editor.levelLang' : 'editor.level')} value={it.level} onChange={(e) => upd((x) => void (x.items[i].level = e.target.value))} />
              <button type="button" className={`${small} hover:text-danger`} onClick={() => upd((x) => void x.items.splice(i, 1))} aria-label={t('common.delete')}>×</button>
            </div>
          ))}
          <button type="button" className="btn border-dashed text-[12.5px] text-accent-300" onClick={() => upd((x) => void x.items.push(emptyItem()))}>
            + {t('editor.addItem')}
          </button>
        </div>
      )}
    </>
  )
}

// ── Anschreiben ─────────────────────────────────────────────────────────────

function LetterForm({ c, part }: { c: LetterContent; part: string }) {
  const { t } = useTranslation()
  const edit = useEdit<LetterContent>()
  const set = <K extends keyof LetterContent>(k: K) => (v: string) => edit((x) => void ((x as unknown as Record<string, string>)[k as string] = v))
  switch (part) {
    case 'sender':
      return (
        <>
          <Head>{t('editor.parts.letter.sender')}</Head>
          <Grid>
            <F wide label={t('fields.name')} value={c.sender.name} onChange={(v) => edit((x) => void (x.sender.name = v))} />
            <F label={t('editor.street')} value={c.sender.street} onChange={(v) => edit((x) => void (x.sender.street = v))} />
            <F label={t('editor.zipCity')} value={c.sender.city} onChange={(v) => edit((x) => void (x.sender.city = v))} />
            <F label={t('fields.phone')} value={c.sender.phone} onChange={(v) => edit((x) => void (x.sender.phone = v))} />
            <F label={t('fields.email')} value={c.sender.email} onChange={(v) => edit((x) => void (x.sender.email = v))} />
          </Grid>
        </>
      )
    case 'recipient':
      return (
        <>
          <Head>{t('editor.parts.letter.recipient')}</Head>
          <Grid>
            <F wide label={t('fields.company')} value={c.recipient.company} onChange={(v) => edit((x) => void (x.recipient.company = v))} />
            <F wide label={t('fields.contactName')} value={c.recipient.contact} onChange={(v) => edit((x) => void (x.recipient.contact = v))} placeholder={t('editor.contactHint')} />
            <F label={t('editor.street')} value={c.recipient.street} onChange={(v) => edit((x) => void (x.recipient.street = v))} />
            <F label={t('editor.zipCity')} value={c.recipient.city} onChange={(v) => edit((x) => void (x.recipient.city = v))} />
          </Grid>
        </>
      )
    case 'meta':
      return (
        <>
          <Head>{t('editor.parts.letter.meta')}</Head>
          <Grid>
            <F label={t('editor.place')} value={c.place} onChange={set('place')} />
            <F label={t('editor.date')} value={c.date} onChange={set('date')} />
            <F wide label={t('editor.subject')} value={c.subject} onChange={set('subject')} />
            <F wide label={t('editor.reference')} value={c.reference} onChange={set('reference')} placeholder={t('editor.referenceHint')} />
          </Grid>
        </>
      )
    case 'body':
      return (
        <>
          <Head>{t('editor.parts.letter.body')}</Head>
          <Grid>
            <F wide label={t('editor.salutation')} value={c.salutation} onChange={set('salutation')} />
            <A label={t('editor.bodyText')} value={c.body} rows={18} onChange={set('body')} />
          </Grid>
          <p className="m-0 text-[11.5px] text-accent-500">{t('editor.paragraphHint')}</p>
        </>
      )
    default:
      return (
        <>
          <Head>{t('editor.parts.letter.closing')}</Head>
          <Grid>
            <F wide label={t('editor.closing')} value={c.closing} onChange={set('closing')} />
            <F wide label={t('editor.signatureName')} value={c.signatureName} onChange={set('signatureName')} />
            <A label={t('editor.attachments')} value={c.attachments} rows={3} onChange={set('attachments')} />
          </Grid>
        </>
      )
  }
}

// ── Deckblatt & freies Dokument ─────────────────────────────────────────────

function CoverForm({ c }: { c: CoverContent }) {
  const { t } = useTranslation()
  const edit = useEdit<CoverContent>()
  const set = (k: keyof Omit<CoverContent, 'kind' | 'style'>) => (v: string) => edit((x) => void (x[k] = v))
  return (
    <>
      <Head>{t('editor.parts.cover.main')}</Head>
      <Grid>
        <F wide label={t('fields.title')} value={c.title} onChange={set('title')} />
        <F wide label={t('editor.subtitle')} value={c.subtitle} onChange={set('subtitle')} />
        <F wide label={t('fields.company')} value={c.company} onChange={set('company')} />
        <F wide label={t('fields.name')} value={c.name} onChange={set('name')} />
        <A label={t('editor.contact')} value={c.contact} rows={4} onChange={set('contact')} />
        <A label={t('editor.attachments')} value={c.attachments} rows={4} onChange={set('attachments')} />
      </Grid>
    </>
  )
}

function FreeForm({ c }: { c: FreeContent }) {
  const { t } = useTranslation()
  const edit = useEdit<FreeContent>()
  return (
    <>
      <Head>{t('editor.parts.free.main')}</Head>
      <Grid>
        <F wide label={t('fields.title')} value={c.title} onChange={(v) => edit((x) => void (x.title = v))} />
        <A label={t('editor.text')} value={c.body} rows={22} onChange={(v) => edit((x) => void (x.body = v))} />
      </Grid>
      <p className="m-0 text-[11.5px] text-accent-500">{t('editor.freeHint')}</p>
    </>
  )
}

export function ContentPanel() {
  const content = useEditor((s) => s.content)!
  const selected = useEditor((s) => s.selected)
  let body: ReactNode
  if (content.kind === 'cv') {
    const sec = content.sections.find((s) => s.id === selected)
    body = sec ? <SectionForm key={sec.id} s={sec} /> : <PersonalForm c={content} />
  } else if (content.kind === 'letter') body = <LetterForm c={content} part={selected} />
  else if (content.kind === 'cover') body = <CoverForm c={content} />
  else body = <FreeForm c={content} />
  return <div className="flex flex-col gap-3">{body}</div>
}
