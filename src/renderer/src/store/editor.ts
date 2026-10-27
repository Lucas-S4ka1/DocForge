/**
 * Editor-State: geöffnetes Dokument, Arbeitskopie des Inhalts, Auswahl, Zoom, Autosave.
 * Änderungen werden nach kurzer Pause automatisch lokal gespeichert.
 */
import { create } from 'zustand'
import { createContent, contentKindFor, isDocContent, type DocContent } from '@shared/document'
import type { DocumentRecord } from '@shared/models'
import { db, useDbState } from './db'

type Meta = Omit<DocumentRecord, 'content'>

interface EditorState {
  doc: Meta | null
  content: DocContent | null
  /** 'personal' | Abschnitts-ID | Briefteil */
  selected: string
  panel: 'content' | 'design'
  zoom: number
  saving: boolean
  dirty: boolean
  savedAt: string | null
  open(id: number): Promise<void>
  close(): Promise<void>
  /** Inhalt ändern (Mutation auf einer Kopie) → Autosave */
  edit(fn: (c: DocContent) => void): void
  rename(title: string): Promise<void>
  select(id: string): void
  setPanel(p: 'content' | 'design'): void
  setZoom(z: number): void
  flush(): Promise<void>
}

let timer: ReturnType<typeof setTimeout> | null = null

export const useEditor = create<EditorState>((set, get) => ({
  doc: null,
  content: null,
  selected: 'personal',
  panel: 'content',
  zoom: 0.85,
  saving: false,
  dirty: false,
  savedAt: null,

  open: async (id) => {
    await get().flush()
    const rec = await db.documents.get(id)
    const { content, ...meta } = rec
    const valid = isDocContent(content) && content.kind === contentKindFor[rec.type]
    const profile = valid ? null : await db.profiles.get(rec.profileId).catch(() => null)
    set({
      doc: meta,
      content: valid ? content : createContent(rec.type, profile, rec.language),
      selected: rec.type === 'cv' ? 'personal' : rec.type === 'cover_letter' ? 'sender' : 'main',
      panel: 'content',
      dirty: !valid,
      savedAt: rec.updatedAt
    })
    if (!valid) scheduleSave()
  },

  close: async () => {
    await get().flush()
    set({ doc: null, content: null })
  },

  edit: (fn) => {
    const cur = get().content
    if (!cur) return
    const next = structuredClone(cur)
    fn(next)
    set({ content: next, dirty: true })
    scheduleSave()
  },

  rename: async (title) => {
    const d = get().doc
    if (!d || !title.trim()) return
    const rec = await db.documents.updateMeta(d.id, { title: title.trim() })
    set({ doc: { ...d, title: rec.title } })
    useDbState.getState().bump()
  },

  select: (selected) => set({ selected, panel: 'content' }),
  setPanel: (panel) => set({ panel }),
  setZoom: (z) => set({ zoom: Math.min(1.6, Math.max(0.4, Math.round(z * 100) / 100)) }),

  flush: async () => {
    if (timer) clearTimeout(timer)
    timer = null
    const { doc, content, dirty } = get()
    if (!doc || !content || !dirty) return
    set({ saving: true })
    try {
      const rec = await db.documents.autosave(doc.id, content)
      // Vorlage auch in den Metadaten führen (für Listen/Filter)
      if (rec.template !== content.style.template) await db.documents.updateMeta(doc.id, { template: content.style.template })
      set({ dirty: false, savedAt: rec.updatedAt, doc: { ...doc, currentVersion: rec.currentVersion, updatedAt: rec.updatedAt } })
      useDbState.getState().bump()
    } finally {
      set({ saving: false })
    }
  }
}))

function scheduleSave() {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => void useEditor.getState().flush(), 800)
}

// Beim Schließen des Fensters nichts verlieren
window.addEventListener('beforeunload', () => void useEditor.getState().flush())
