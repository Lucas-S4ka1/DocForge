/**
 * Tab "Fotos": Galerie der lokal gespeicherten Bewerbungsfotos.
 * Fotos entstehen im Kamera-Studio oder per Datei-Import im Editor.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/ui/Panel'
import { ConfirmDialog } from '@/components/ui/Modal'
import { db, mutate, useQuery } from '@/store/db'
import { useApp } from '@/store/app'
import { useArchive } from '@/store/archive'
import { formatDateTime } from '@/lib/format'
import { MiniButton, RecordPanel, SectionLabel, useAction } from './common'
import { TagEditor } from '@/components/ui/TagEditor'

export function PhotosTab() {
  const { t } = useTranslation()
  const lang = useApp((s) => s.settings.language)
  const run = useAction()
  const { profileId, tags, selected, select } = useArchive()
  const all = useQuery(() => db.photos.list(profileId), [profileId]).data ?? []
  const photos = tags.length ? all.filter((p) => tags.every((tg) => p.tags.includes(tg))) : all
  const current = photos.find((p) => p.id === selected.photos) ?? null
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto border border-line p-4">
        {photos.length === 0 ? (
          <div className="flex h-full">
            <EmptyState title={t('archive.emptyPhotos')} hint={t('archive.emptyPhotosHint')} />
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
            {photos.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => select('photos', p.id)}
                className={`flex flex-col gap-1.5 border p-1.5 text-left ${p.id === current?.id ? 'border-accent-400 shadow-glow-sm' : 'border-line hover:border-accent-500'}`}
              >
                <img src={`docforge-photo://${encodeURIComponent(p.fileName)}`} alt="" className="aspect-[3/4] w-full bg-void object-cover" loading="lazy" />
                <span className="truncate px-0.5 text-[11px] text-accent-300">{p.label ?? formatDateTime(p.createdAt, lang)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <RecordPanel
        id={current?.id}
        actions={
          <MiniButton danger onClick={() => setConfirmDelete(true)}>
            {t('common.delete')}
          </MiniButton>
        }
      >
        {current && (
          <>
            <img src={`docforge-photo://${encodeURIComponent(current.fileName)}`} alt="" className="w-full border border-line" />
            <span className="font-mono text-[12px] text-accent-300">
              {current.width}×{current.height} · {current.format.toUpperCase()} · {formatDateTime(current.createdAt, lang)}
            </span>
            <div className="mt-auto flex flex-col gap-2 pt-2">
              <SectionLabel>{t('archive.tags')}</SectionLabel>
              <TagEditor tags={current.tags} onChange={(next) => run(() => mutate(() => db.tags.set('photo', current.id, next)))} />
            </div>
          </>
        )}
      </RecordPanel>
      {confirmDelete && current && (
        <ConfirmDialog
          title={t('archive.deletePhoto')}
          text={t('archive.deletePhotoText')}
          confirmLabel={t('common.delete')}
          danger
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            setConfirmDelete(false)
            const ok = await run(async () => (await mutate(() => db.photos.remove(current.id)), true), t('archive.deleted'))
            if (ok) select('photos', null)
          }}
        />
      )}
    </>
  )
}
