/**
 * Vorschau nach dem Einlesen einer Word-/PDF-Datei: was wurde erkannt, was fehlt noch,
 * in welche Vorlage sollen die Daten? "Übernehmen" legt ein neues Dokument an und öffnet den Editor.
 */
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cvChecklist, templatesByType, type CvContent, type LetterContent } from '@shared/document'
import { buildImportedContent, guessType } from '@shared/importer'
import { Modal } from './ui/Modal'
import { Segmented } from './ui/Controls'
import { AsideLabel } from './layout/TopBar'
import { DocumentView } from '@/documents/DocumentView'
import { TemplatePicker } from '@/documents/TemplatePicker'
import { useImport } from '@/store/importer'
import { useApp } from '@/store/app'
import { db, useQuery } from '@/store/db'

type ImportType = 'cv' | 'cover_letter'

export function ImportDialog() {
  const file = useImport((s) => s.file)
  if (!file) return null
  return <ImportReview key={file.fileName + file.text.length} />
}

function ImportReview() {
  const { t } = useTranslation()
  const { file, busy, close, finish } = useImport()
  const lang = useApp((s) => s.settings.language)
  const activeProfileId = useApp((s) => s.settings.activeProfileId)
  const profile = useQuery(() => (activeProfileId ? db.profiles.get(activeProfileId).catch(() => null) : Promise.resolve(null)), [activeProfileId])

  const [type, setType] = useState<ImportType>(() => guessType(file!.text))
  const [template, setTemplate] = useState<Record<ImportType, string>>({ cv: templatesByType.cv[0], cover_letter: templatesByType.cover_letter[0] })
  const [usePhoto, setUsePhoto] = useState(true)
  const [newProfile, setNewProfile] = useState(true)

  const { content, summary } = useMemo(
    () => buildImportedContent(type, file!.text, profile.data ?? null, lang),
    [type, file, profile.data, lang]
  )
  // Foto aus der Word-Datei als Vorschau (blob: ist in der CSP erlaubt)
  const photoUrl = useMemo(() => (file!.photo ? URL.createObjectURL(new Blob([new Uint8Array(file!.photo.data)], { type: `image/${file!.photo.format}` })) : null), [file])
  useEffect(() => () => void (photoUrl && URL.revokeObjectURL(photoUrl)), [photoUrl])

  const styled = useMemo(() => ({ ...content, style: { ...content.style, template: template[type] } }) as CvContent | LetterContent, [content, template, type])
  // nur für die Vorschau: Foto aus der Datei anzeigen (gespeichert wird es erst beim Übernehmen)
  const preview = useMemo(
    () => (styled.kind === 'cv' && usePhoto && photoUrl ? { ...styled, style: { ...styled.style, photo: photoUrl } } : styled),
    [styled, usePhoto, photoUrl]
  )

  const missing =
    styled.kind === 'cv'
      ? cvChecklist(preview as CvContent)
          .filter((c) => !c.done)
          .map((c) => t(`editor.checks.${c.key}`))
      : [
          !styled.recipient.company && t('import.missing.recipient'),
          !summary.sections[1]?.count && t('import.missing.text')
        ].filter((x): x is string => !!x)

  return (
    <Modal
      tag="IMPORT"
      title={t('import.title')}
      onClose={close}
      width={940}
      footer={
        <>
          <button type="button" className="btn" onClick={close}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-primary" disabled={busy || profile.loading} onClick={() => void finish({ type, content: styled, usePhoto: usePhoto && !!photoUrl, newProfile: summary.otherPerson && newProfile })}>
            {t('import.apply')}
          </button>
        </>
      }
    >
      <div className="flex gap-6">
        {/* A4-Vorschau im gewählten Layout */}
        <div className="flex w-[318px] flex-none flex-col gap-2">
          <div className="h-[450px] overflow-hidden bg-white shadow-[0_0_0_1px_rgb(var(--accent-400)/0.35)]" data-testid="import-preview">
            <div style={{ zoom: 0.4 }} className="pointer-events-none">
              <DocumentView content={preview} mode="thumb" lang={lang} />
            </div>
          </div>
          <span className="text-[11.5px] text-accent-400">{t('import.previewHint')}</span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="min-w-0 flex-1 truncate border border-line px-2.5 py-1.5 text-[13px] text-accent-200" title={file!.fileName}>
              {file!.fileName}
            </span>
            <Segmented<ImportType>
              ariaLabel={t('import.type')}
              value={type}
              onChange={setType}
              options={[
                { value: 'cv', label: t('docType.cv') },
                { value: 'cover_letter', label: t('docType.cover_letter') }
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <AsideLabel>{t('import.found')}</AsideLabel>
              <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px] text-accent-200" data-testid="import-found">
                {type === 'cv' ? (
                  <>
                    <Found ok={summary.name}>{t('import.name')}</Found>
                    <Found ok={summary.contact > 0}>{t('import.contact', { count: summary.contact })}</Found>
                    {summary.sections.map((s, i) => (
                      <Found key={i} ok>
                        {s.title} · {s.kind === 'profile' || (s.kind === 'custom' && s.count === 1) ? t('import.text') : t('import.entries', { count: s.count })}
                      </Found>
                    ))}
                  </>
                ) : (
                  <>
                    <Found ok={summary.sections[0].count > 0}>{t('import.missing.recipient')}</Found>
                    <Found ok={summary.sections[1].count > 0}>{t('import.letterParts', { count: summary.sections[1].count })}</Found>
                    <Found ok={summary.name}>{t('import.signature')}</Found>
                  </>
                )}
              </ul>
              {photoUrl && type === 'cv' && (
                <label className="mt-1 flex cursor-pointer items-center gap-2.5 text-[13px] text-accent-200">
                  <img src={photoUrl} alt="" className="h-[52px] w-[40px] border border-line object-cover" />
                  <input type="checkbox" checked={usePhoto} onChange={(e) => setUsePhoto(e.target.checked)} />
                  {t('import.usePhoto')}
                </label>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <AsideLabel>{t('import.todo')}</AsideLabel>
              {missing.length ? (
                <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px] text-accent-300">
                  {missing.map((m) => (
                    <li key={m}>○ {m}</li>
                  ))}
                </ul>
              ) : (
                <span className="text-[13px] text-accent-300">{t('import.nothingMissing')}</span>
              )}
              <span className="mt-1 text-[12px] leading-snug text-accent-400">{t('import.todoHint')}</span>
            </div>
          </div>

          {summary.otherPerson && (
            <label className="flex cursor-pointer items-start gap-2.5 border-l-2 border-accent-400 bg-accent-900/40 px-3 py-2 text-[12.5px] text-accent-200">
              <input type="checkbox" className="mt-0.5" checked={newProfile} onChange={(e) => setNewProfile(e.target.checked)} />
              <span>
                {t('import.otherPerson', { name: summary.person, profile: profile.data?.name ?? '' })}
                {!newProfile && <span className="block text-accent-400">{t('import.otherPersonKeep')}</span>}
              </span>
            </label>
          )}

          {summary.fallback && (
            <div className="border-l-2 border-accent-400 bg-accent-900/40 px-3 py-2 text-[12.5px] text-accent-200">{t(type === 'cv' ? 'import.fallbackCv' : 'import.fallbackLetter')}</div>
          )}

          <div className="flex flex-col gap-2">
            <AsideLabel>{t('import.layout')}</AsideLabel>
            <TemplatePicker
              type={type}
              content={preview}
              lang={lang}
              value={template[type]}
              onChange={(tpl) => setTemplate((x) => ({ ...x, [type]: tpl }))}
              columns={4}
            />
          </div>
          <span className="text-[12px] text-accent-400">{t('import.note')}</span>
        </div>
      </div>
    </Modal>
  )
}

function Found({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className={ok ? '' : 'text-accent-500'}>
      <span className={ok ? 'text-accent-300' : ''}>{ok ? '✓' : '–'}</span> {children}
    </li>
  )
}
