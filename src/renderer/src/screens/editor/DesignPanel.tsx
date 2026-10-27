/**
 * Rechte Spalte, Reiter "Design": Vorlage (mit Live-Miniaturen), Schrift, Akzentfarbe,
 * Ränder, Fotoposition und Fotoauswahl.
 */
import { useTranslation } from 'react-i18next'
import { accentPresets, docFonts, templatesByType, type DocFont, type MarginSize, type PhotoPosition } from '@shared/document'
import { DocumentView } from '@/documents/DocumentView'
import { useEditor } from '@/store/editor'
import { useApp } from '@/store/app'
import { db, mutate, useQuery } from '@/store/db'
import { Segmented, Field } from '@/components/ui/Controls'
import { AsideLabel } from '@/components/layout/TopBar'
import { useAction } from '../archive/common'

export function DesignPanel() {
  const { t } = useTranslation()
  const lang = useApp((s) => s.settings.language)
  const content = useEditor((s) => s.content)!
  const doc = useEditor((s) => s.doc)!
  const edit = useEditor((s) => s.edit)
  const run = useAction()
  const style = content.style
  const photos = useQuery(() => db.photos.list(doc.profileId), [doc.profileId]).data ?? []
  const set = <K extends keyof typeof style>(k: K, v: (typeof style)[K]) => edit((c) => void (c.style[k] = v))
  const supportsPhoto = content.kind === 'cv' || content.kind === 'cover'
  const supportsMargins = content.kind !== 'letter'

  const importPhoto = () =>
    run(async () => {
      const p = await mutate(() => window.docforge.photos.importFromFile(doc.profileId))
      if (p) {
        edit((c) => {
          c.style.photo = p.fileName
          if (c.style.photoPosition === 'none') c.style.photoPosition = 'right'
        })
      }
    })

  return (
    <div className="flex flex-col gap-[18px]">
      <AsideLabel>{t('editor.template')}</AsideLabel>
      <div className="grid grid-cols-3 gap-2.5">
        {templatesByType[doc.type].map((tpl) => {
          const on = style.template === tpl
          return (
            <button key={tpl} type="button" onClick={() => set('template', tpl)} className="flex flex-col items-center gap-1.5">
              <div
                className={`relative h-[110px] w-[78px] overflow-hidden bg-white ${on ? 'outline outline-2 outline-offset-2 outline-accent-300 shadow-glow' : 'opacity-80 hover:opacity-100'}`}
              >
                <div style={{ zoom: 0.0975 }} className="pointer-events-none">
                  <DocumentView content={{ ...content, style: { ...style, template: tpl } } as typeof content} mode="thumb" lang={lang} />
                </div>
              </div>
              <span className={`text-[11.5px] ${on ? 'text-accent-100' : 'text-accent-300'}`}>{t(`templates.${tpl}`)}</span>
            </button>
          )
        })}
      </div>

      <AsideLabel>{t('editor.properties')}</AsideLabel>
      <Field label={t('editor.font')}>
        <select className="input cursor-pointer bg-ground text-[13px]" value={style.font} onChange={(e) => set('font', e.target.value as DocFont)}>
          {(Object.keys(docFonts) as DocFont[]).map((f) => (
            <option key={f} value={f}>
              {docFonts[f].label}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t('editor.accent')}>
        <div className="flex flex-wrap items-center gap-2">
          {accentPresets.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              onClick={() => set('accent', c)}
              className={`h-7 w-7 ${style.accent.toLowerCase() === c.toLowerCase() ? 'outline outline-2 outline-offset-2 outline-accent-200' : ''}`}
              style={{ background: c }}
            />
          ))}
          <label className="relative h-7 w-7 cursor-pointer border border-dashed border-line" title={t('editor.customColor')}>
            <input type="color" value={style.accent} onChange={(e) => set('accent', e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
            <span className="grid h-full place-items-center text-[13px] text-accent-300">+</span>
          </label>
        </div>
      </Field>
      {supportsMargins && (
        <Field label={t('editor.margins')}>
          <Segmented<MarginSize>
            ariaLabel={t('editor.margins')}
            value={style.margins}
            onChange={(v) => set('margins', v)}
            options={[
              { value: 'narrow', label: t('editor.narrow') },
              { value: 'normal', label: t('editor.normal') },
              { value: 'wide', label: t('editor.wide') }
            ]}
          />
        </Field>
      )}
      {!supportsMargins && <p className="m-0 text-[12px] text-accent-400">{t('editor.dinHint')}</p>}

      {supportsPhoto && (
        <>
          <Field label={t('editor.photoPosition')}>
            <Segmented<PhotoPosition>
              ariaLabel={t('editor.photoPosition')}
              value={style.photoPosition}
              onChange={(v) => set('photoPosition', v)}
              options={[
                { value: 'left', label: t('editor.left') },
                { value: 'right', label: t('editor.right') },
                { value: 'none', label: t('editor.none') }
              ]}
            />
          </Field>
          {style.photoPosition !== 'none' && (
            <Field label={t('editor.photo')}>
              <div className="grid grid-cols-4 gap-1.5">
                {photos.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => set('photo', p.fileName)}
                    className={`aspect-[3/4] overflow-hidden border ${style.photo === p.fileName ? 'border-accent-300 shadow-glow-sm' : 'border-line'}`}
                  >
                    <img src={`docforge-photo://${encodeURIComponent(p.fileName)}`} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn text-[12.5px]" onClick={() => useApp.getState().navigate('studio')}>
                  {t('editor.openStudio')}
                </button>
                <button type="button" className="btn text-[12.5px]" onClick={importPhoto}>
                  {t('editor.importPhoto')}
                </button>
                {style.photo && (
                  <button type="button" className="btn btn-ghost text-[12.5px]" onClick={() => set('photo', null)}>
                    {t('editor.removePhoto')}
                  </button>
                )}
              </div>
            </Field>
          )}
        </>
      )}
    </div>
  )
}
