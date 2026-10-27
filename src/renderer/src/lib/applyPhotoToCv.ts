/**
 * "Im Lebenslauf verwenden": setzt ein Foto im geöffneten Lebenslauf/Deckblatt,
 * sonst im zuletzt bearbeiteten Lebenslauf des aktiven Profils (oder legt einen an).
 */
import { useApp } from '@/store/app'
import { useEditor } from '@/store/editor'
import { db } from '@/store/db'
import { createAndOpen } from './newDocument'

export async function applyPhotoToCv(fileName: string): Promise<'opened' | 'created' | 'no-profile'> {
  const editor = useEditor.getState()
  const apply = () =>
    useEditor.getState().edit((c) => {
      c.style.photo = fileName
      if (c.style.photoPosition === 'none') c.style.photoPosition = 'right'
    })

  if (editor.doc && (editor.doc.type === 'cv' || editor.doc.type === 'cover_page')) {
    apply()
    useApp.getState().navigate('editor')
    return 'opened'
  }
  const profileId = useApp.getState().settings.activeProfileId
  const latest = (await db.documents.list({ type: 'cv', profileId, limit: 1 }))[0]
  if (latest) {
    await editor.open(latest.id)
    apply()
    useApp.getState().navigate('editor')
    return 'opened'
  }
  const ok = await createAndOpen('cv')
  if (!ok) return 'no-profile'
  apply()
  return 'created'
}
