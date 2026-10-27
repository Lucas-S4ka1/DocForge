/**
 * Einstellungen → KI-Befehlsleiste: API-Key (verschlüsselt gespeichert) und Modellwahl.
 * Der Key wird nach dem Speichern nie wieder angezeigt – nur die letzten 4 Zeichen.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { claudeModels, type ClaudeModelId } from '@shared/ai'
import { ipcErrorCode } from '@shared/ipc'
import { useAi } from '@/store/ai'
import { useApp } from '@/store/app'
import { toast } from '@/store/toast'
import { Field } from '@/components/ui/Controls'

export function AiSettings() {
  const { t } = useTranslation()
  const { status, refreshStatus } = useAi()
  const model = useApp((s) => s.settings.claudeModel)
  const update = useApp((s) => s.updateSettings)
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void refreshStatus()
  }, [refreshStatus])

  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true)
    try {
      await fn()
      if (ok) toast.success(ok)
    } catch (e) {
      toast.error(t(`ai.errors.${ipcErrorCode(e)}`, { defaultValue: t('ai.errors.AI_FAILED') }))
    } finally {
      setBusy(false)
      void refreshStatus()
    }
  }

  return (
    <>
      {status && !status.encryptionAvailable && <p className="m-0 text-[12px] text-warning">{t('ai.errors.AI_NO_ENCRYPTION')}</p>}
      {status?.hasKey ? (
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[13px] text-accent-200">
            ✓ {t('settings.keyStored')} ••••{status.keyHint}
          </span>
          <div className="flex gap-2">
            <button type="button" className="btn" disabled={busy} onClick={() => act(() => window.docforge.ai.testKey(), t('settings.keyOk'))}>
              {t('settings.testKey')}
            </button>
            <button type="button" className="btn hover:border-danger/70 hover:text-danger" disabled={busy} onClick={() => act(() => window.docforge.ai.removeKey(), t('settings.keyRemoved'))}>
              {t('settings.removeKey')}
            </button>
          </div>
        </div>
      ) : (
        <Field label={t('settings.apiKey')}>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              void act(async () => {
                await window.docforge.ai.setKey(key)
                setKey('')
              }, t('settings.keySaved'))
            }}
          >
            <input className="input font-mono text-[13px]" type="password" autoComplete="off" spellCheck={false} placeholder="sk-ant-…" value={key} onChange={(e) => setKey(e.target.value)} />
            <button type="submit" className="btn btn-primary flex-none" disabled={busy || key.trim().length < 20}>
              {t('common.save')}
            </button>
          </form>
        </Field>
      )}
      <p className="m-0 text-[12px] text-accent-400">{t('settings.apiKeyHint')}</p>
      <Field label={t('settings.model')}>
        <select className="input cursor-pointer bg-ground text-[13px]" value={model} onChange={(e) => update({ claudeModel: e.target.value as ClaudeModelId })}>
          {claudeModels.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label} – {t(`settings.modelHint.${m.id}`)}
            </option>
          ))}
        </select>
      </Field>
      <p className="m-0 text-[12px] text-accent-500">{t('settings.aiPrivacy')}</p>
    </>
  )
}
