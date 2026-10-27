/**
 * Prompt-Befehlsleiste unten im Editor ("> Befehl eingeben …").
 * Schickt Dokument + Befehl (+ optional Stellenanzeige) an Claude. Ohne API-Key: Hinweis.
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAi } from '@/store/ai'
import { useEditor } from '@/store/editor'
import { useApp } from '@/store/app'
import { db, mutate } from '@/store/db'
import { Corners } from '@/components/ui/Panel'
import { Modal } from '@/components/ui/Modal'

const quick = ['formal', 'shorten', 'tailor', 'translate', 'improve'] as const

export function CommandBar() {
  const { t } = useTranslation()
  const doc = useEditor((s) => s.doc)!
  const { status, running, error, proposal, postings, refreshStatus, run, cancel, setPosting } = useAi()
  const navigate = useApp((s) => s.navigate)
  const [command, setCommand] = useState('')
  const [postingOpen, setPostingOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const posting = postings[doc.id] ?? ''

  useEffect(() => {
    void refreshStatus()
  }, [refreshStatus])

  // Stellenanzeige aus der verknüpften Bewerbung übernehmen
  useEffect(() => {
    if (!doc.applicationId || postings[doc.id] !== undefined) return
    void db.applications.get(doc.applicationId).then((a) => a.jobPosting && setPosting(doc.id, a.jobPosting))
  }, [doc.id, doc.applicationId, postings, setPosting])

  const submit = (text = command) => {
    if (!text.trim() || running) return
    if (text === t('ai.quick.tailor') && !posting) {
      setPostingOpen(true)
      return
    }
    void run(text)
  }

  if (status && !status.hasKey) {
    return (
      <div className="flex-none px-[22px] pb-[18px] pt-2">
        <div className="blueprint flex h-[52px] items-center gap-3 border-line bg-accent-900/50 pl-4 pr-2">
          <Corners />
          <span className="font-mono text-[16px] text-accent-500">&gt;</span>
          <span className="flex-1 text-[13px] text-accent-300">{t('ai.noKey')}</span>
          <button type="button" className="btn" onClick={() => navigate('settings')}>
            {t('ai.toSettings')}
          </button>
        </div>
      </div>
    )
  }

  const statusLine = running
    ? t('ai.running')
    : error
      ? t(`ai.errors.${error}`, { defaultValue: t('ai.errors.AI_FAILED') })
      : proposal
        ? t('ai.proposed', { n: proposal.changes.length })
        : null

  return (
    <div className="flex flex-none flex-col gap-2.5 px-[22px] pb-[18px] pt-2">
      {!proposal && !running && (
        <div className="flex flex-wrap gap-2">
          {quick.map((q) => (
            <button key={q} type="button" className="border border-line px-[11px] py-[5px] text-[12px] text-accent-200 hover:border-accent-400" onClick={() => submit(t(`ai.quick.${q}`))}>
              {t(`ai.quick.${q}`)}
            </button>
          ))}
        </div>
      )}
      {statusLine && (
        <span className={`font-mono text-[12px] ${error ? 'text-danger' : 'text-accent-300'}`}>
          [ SYSTEM ] {statusLine}
          {running && <span className="animate-caret ml-1">▍</span>}
        </span>
      )}
      <div className="blueprint flex h-[52px] items-center gap-3 border-accent-400 bg-accent-900/70 pl-4 pr-2 shadow-glow">
        <Corners />
        <span className="font-mono text-[16px] font-medium text-accent-300">&gt;</span>
        <input
          ref={inputRef}
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder={t('editor.commandPlaceholder')}
          disabled={running}
          maxLength={4000}
          className="flex-1 bg-transparent font-mono text-[14px] text-accent-100 placeholder:text-accent-500"
          aria-label={t('editor.commandPlaceholder')}
        />
        <button type="button" onClick={() => setPostingOpen(true)} className={`text-[12px] ${posting ? 'text-accent-200' : 'text-accent-500 hover:text-accent-300'}`}>
          {posting ? t('ai.postingSet') : t('ai.pastePosting')}
        </button>
        {running ? (
          <button type="button" className="btn" onClick={cancel}>
            {t('common.cancel')}
          </button>
        ) : (
          <button type="button" className="btn btn-primary" disabled={!command.trim()} onClick={() => submit()}>
            {t('editor.run')} ⏎
          </button>
        )}
      </div>
      <span className="text-[11px] text-accent-500">{t('ai.privacy')}</span>

      {postingOpen && (
        <PostingDialog
          initial={posting}
          onClose={() => setPostingOpen(false)}
          onSave={async (text) => {
            setPosting(doc.id, text)
            // Für die verknüpfte Bewerbung auch im Archiv speichern
            if (doc.applicationId) await mutate(() => db.applications.update(doc.applicationId!, { jobPosting: text || null }))
            setPostingOpen(false)
          }}
        />
      )}
    </div>
  )
}

function PostingDialog({ initial, onClose, onSave }: { initial: string; onClose(): void; onSave(text: string): void }) {
  const { t } = useTranslation()
  const [text, setText] = useState(initial)
  return (
    <Modal
      tag="INPUT"
      title={t('ai.postingTitle')}
      onClose={onClose}
      width={640}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onSave(text.trim())}>
            {t('common.save')}
          </button>
        </>
      }
    >
      <p className="m-0 text-[13px] text-accent-300">{t('ai.postingHint')}</p>
      <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={16} className="input resize-y text-[13px]" placeholder={t('ai.postingPlaceholder')} />
    </Modal>
  )
}
