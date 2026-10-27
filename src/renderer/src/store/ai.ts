/**
 * State der KI-Befehlsleiste: Key-Status, laufende Anfrage, Vorschlag (Review) mit
 * Auswahl einzelner Änderungen, Stellenanzeige je Dokument.
 */
import { create } from 'zustand'
import { applyChanges, type AiResult, type AiStatus } from '@shared/ai'
import { ipcErrorCode } from '@shared/ipc'
import { useEditor } from './editor'

export interface Proposal extends AiResult {
  command: string
  documentId: number
  invalidCount: number
  /** Index → übernehmen ja/nein */
  accepted: boolean[]
  baseVersion: number
}

interface AiState {
  status: AiStatus | null
  running: boolean
  error: string | null
  proposal: Proposal | null
  /** Stellenanzeige je Dokument-ID (Sitzung) */
  postings: Record<number, string>
  /** Ansicht im Review: Änderungsliste oder Vorschau des Ergebnisses */
  reviewView: 'diff' | 'preview'
  refreshStatus(): Promise<void>
  run(command: string): Promise<void>
  cancel(): void
  toggle(i: number, value?: boolean): void
  setAll(value: boolean): void
  apply(onlySelected: boolean): Promise<number>
  discard(): void
  setPosting(documentId: number, text: string): void
  setReviewView(v: 'diff' | 'preview'): void
}

export const useAi = create<AiState>((set, get) => ({
  status: null,
  running: false,
  error: null,
  proposal: null,
  postings: {},
  reviewView: 'diff',

  refreshStatus: async () => set({ status: await window.docforge.ai.status() }),

  run: async (command) => {
    const editor = useEditor.getState()
    const doc = editor.doc
    if (!doc || !command.trim() || get().running) return
    set({ running: true, error: null })
    try {
      await editor.flush()
      const r = await window.docforge.ai.run({ documentId: doc.id, command, jobPosting: get().postings[doc.id] ?? null })
      set({
        proposal: { ...r, command, documentId: doc.id, accepted: r.changes.map(() => true), baseVersion: useEditor.getState().doc?.currentVersion ?? doc.currentVersion },
        reviewView: 'diff'
      })
    } catch (e) {
      set({ error: ipcErrorCode(e) })
    } finally {
      set({ running: false })
    }
  },

  cancel: () => void window.docforge.ai.cancel(),

  toggle: (i, value) => {
    const p = get().proposal
    if (!p) return
    const accepted = [...p.accepted]
    accepted[i] = value ?? !accepted[i]
    set({ proposal: { ...p, accepted } })
  },

  setAll: (value) => {
    const p = get().proposal
    if (p) set({ proposal: { ...p, accepted: p.accepted.map(() => value) } })
  },

  /** Übernimmt alle bzw. die ausgewählten Änderungen als neue Version. Gibt die Anzahl zurück. */
  apply: async (onlySelected) => {
    const p = get().proposal
    const editor = useEditor.getState()
    if (!p || !editor.content || editor.doc?.id !== p.documentId) return 0
    const chosen = p.changes.filter((_, i) => !onlySelected || p.accepted[i])
    if (chosen.length) await editor.commit(applyChanges(editor.content, chosen), `KI: ${p.command}`.slice(0, 300))
    set({ proposal: null })
    return chosen.length
  },

  discard: () => set({ proposal: null }),
  setPosting: (documentId, text) => set({ postings: { ...get().postings, [documentId]: text } }),
  setReviewView: (reviewView) => set({ reviewView })
}))
