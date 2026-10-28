/**
 * Import vorhandener Dokumente: Datei wählen → Vorschau-Dialog (erkannte Daten, Vorlage wählen)
 * → als neues Dokument anlegen und im Editor öffnen. Das Original bleibt unverändert.
 */
import { create } from 'zustand'
import type { ImportedFile } from '@shared/ipc'
import type { CvContent, LetterContent } from '@shared/document'
import { ipcErrorCode } from '@shared/ipc'
import { db, mutate } from './db'
import { useApp } from './app'
import { toast } from './toast'
import { openInEditor } from '@/lib/newDocument'
import i18n from '@/i18n'

interface ImportState {
  busy: boolean
  file: ImportedFile | null
  /** Öffnen-Dialog zeigen und Datei einlesen; danach erscheint der Vorschau-Dialog. */
  begin(): Promise<void>
  close(): void
  /** Inhalt (mit gewählter Vorlage) als neues Dokument anlegen und im Editor öffnen. */
  finish(input: { type: 'cv' | 'cover_letter'; content: CvContent | LetterContent; usePhoto: boolean; newProfile: boolean }): Promise<void>
}

const importErrors = ['IMPORT_DOC', 'IMPORT_TYPE', 'IMPORT_SIZE', 'IMPORT_EMPTY', 'IMPORT_BROKEN']

export const useImport = create<ImportState>()((set, get) => ({
  busy: false,
  file: null,

  begin: async () => {
    if (get().busy) return
    set({ busy: true })
    try {
      const file = await window.docforge.importer.pickFile()
      if (file) set({ file })
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      const code = importErrors.find((c) => msg.includes(c))
      toast.error(i18n.t(code ? `import.errors.${code}` : `errors.${ipcErrorCode(e)}`, { defaultValue: i18n.t('errors.INTERNAL') }))
    } finally {
      set({ busy: false })
    }
  },

  close: () => set({ file: null }),

  finish: async ({ type, content, usePhoto, newProfile }) => {
    const file = get().file
    if (!file) return
    set({ busy: true })
    try {
      const { settings, updateSettings } = useApp.getState()
      const lang = settings.language
      // Noch kein Profil (oder Datei einer anderen Person)? Dann aus den erkannten Daten anlegen
      let profileId = newProfile ? null : (settings.activeProfileId ?? (await db.profiles.list())[0]?.id ?? null)
      if (!profileId) {
        const p = content.kind === 'cv' ? content.personal : null
        const name = (content.kind === 'cv' ? p?.name : content.signatureName || content.sender.name) || i18n.t('import.defaultProfile')
        const profile = await mutate(() =>
          db.profiles.create({
            name,
            headline: p?.headline || null,
            email: (p?.email ?? (content.kind === 'letter' ? content.sender.email : '')) || null,
            phone: (p?.phone ?? (content.kind === 'letter' ? content.sender.phone : '')) || null,
            address: p?.address || null,
            city: p?.city || null
          })
        )
        profileId = profile.id
        await updateSettings({ activeProfileId: profileId })
      }

      const doc = structuredClone(content)
      if (usePhoto && file.photo && doc.kind === 'cv') {
        const photo = await mutate(() => window.docforge.photos.saveCaptured({ ...file.photo!, profileId, label: 'Import' }))
        doc.style.photo = photo.fileName
        if (doc.style.photoPosition === 'none') doc.style.photoPosition = 'right'
      }

      const base = file.fileName.replace(/\.[^.]+$/, '')
      const title = `${i18n.t(type === 'cv' ? 'import.titleCv' : 'import.titleLetter')} – ${base}`.slice(0, 200)
      const rec = await mutate(() => db.documents.create({ profileId: profileId!, applicationId: null, type, title, language: lang, template: doc.style.template, content: doc }))
      set({ file: null })
      await openInEditor(rec.id)
      toast.success(i18n.t('import.done'))
    } catch (e) {
      toast.error(i18n.t(`errors.${ipcErrorCode(e)}`, { defaultValue: i18n.t('errors.INTERNAL') }))
    } finally {
      set({ busy: false })
    }
  }
}))
