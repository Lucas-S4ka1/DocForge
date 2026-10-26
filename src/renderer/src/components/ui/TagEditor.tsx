/** Tags als "#chips" mit Eingabefeld zum Hinzufügen (Enter) und × zum Entfernen. */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export function TagChip({ name, active, onClick }: { name: string; active?: boolean; onClick?(): void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`border px-3 py-[6px] text-[12px] transition-colors ${
        active ? 'border-accent-400 bg-accent-500/15 text-accent-100 shadow-glow-sm' : 'border-line text-accent-200 hover:border-accent-400'
      } disabled:cursor-default`}
    >
      #{name}
    </button>
  )
}

export function TagEditor({ tags, onChange }: { tags: string[]; onChange(tags: string[]): void }) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState('')
  const add = () => {
    const v = draft.trim().replace(/^#/, '')
    if (v && !tags.includes(v.toLowerCase())) onChange([...tags, v])
    setDraft('')
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {tags.map((tag) => (
        <span key={tag} className="flex items-center gap-1.5 border border-line px-2.5 py-[5px] text-[12px] text-accent-200">
          #{tag}
          <button type="button" aria-label={`${tag} ×`} className="text-accent-500 hover:text-danger" onClick={() => onChange(tags.filter((x) => x !== tag))}>
            ×
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            add()
          }
        }}
        onBlur={add}
        placeholder={t('archive.addTag')}
        className="w-28 border border-dashed border-line bg-transparent px-2.5 py-[5px] text-[12px] text-accent-100 placeholder:text-accent-500"
      />
    </div>
  )
}
