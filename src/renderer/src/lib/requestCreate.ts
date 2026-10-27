/**
 * Einstieg für "Neues Dokument": legt an, oder fordert zuerst ein Profil an,
 * falls noch keins existiert (AppShell zeigt dann das Profil-Formular).
 */
import type { DocumentType } from '@shared/models'
import { useApp } from '@/store/app'
import { toast } from '@/store/toast'
import { createAndOpen } from './newDocument'

export async function requestCreate(type: DocumentType, applicationId?: number | null): Promise<void> {
  try {
    const ok = await createAndOpen(type, { applicationId })
    if (!ok) useApp.getState().setPendingCreate({ type, applicationId: applicationId ?? null })
  } catch {
    toast.error('Dokument konnte nicht angelegt werden.')
  }
}
