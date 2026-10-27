/**
 * Neue Dokumente anlegen (aus Hub, Archiv oder Editor) – vorbelegt mit Profildaten.
 */
import { createContent } from '@shared/document'
import type { DocumentType } from '@shared/models'
import { db, mutate } from '@/store/db'
import { useApp } from '@/store/app'
import { useEditor } from '@/store/editor'

const defaultTitles: Record<'de' | 'en', Record<DocumentType, string>> = {
  de: { cv: 'Lebenslauf', cover_letter: 'Anschreiben', cover_page: 'Deckblatt', free: 'Dokument' },
  en: { cv: 'CV', cover_letter: 'Cover letter', cover_page: 'Cover page', free: 'Document' }
}

/**
 * Legt ein Dokument an und öffnet es im Editor.
 * Gibt `false` zurück, wenn noch kein Profil existiert (Aufrufer zeigt dann das Profil-Formular).
 */
export async function createAndOpen(type: DocumentType, opts: { applicationId?: number | null } = {}): Promise<boolean> {
  const { settings, navigate } = useApp.getState()
  const lang = settings.language
  let profileId = settings.activeProfileId
  if (!profileId) profileId = (await db.profiles.list())[0]?.id ?? null
  if (!profileId) return false

  const profile = await db.profiles.get(profileId)
  let company: string | undefined
  if (opts.applicationId) company = (await db.applications.getRow(opts.applicationId)).companyName

  const content = createContent(type, profile, lang, company)
  const title = [defaultTitles[lang][type], company ?? profile.name].filter(Boolean).join(' – ')
  const rec = await mutate(() =>
    db.documents.create({ profileId: profileId!, applicationId: opts.applicationId ?? null, type, title, language: lang, template: content.style.template, content })
  )
  await useEditor.getState().open(rec.id)
  navigate('editor')
  return true
}

export async function openInEditor(id: number): Promise<void> {
  await useEditor.getState().open(id)
  useApp.getState().navigate('editor')
}
