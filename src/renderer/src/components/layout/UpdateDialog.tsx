/**
 * Update-Ablauf mit Systemmeldungen im App-Stil:
 * "[ SYSTEM ] Neue Version X verfügbar" → Changelog → Herunterladen (Fortschritt)
 * → "Jetzt neu starten und installieren" / "Später".
 */
import { useTranslation } from 'react-i18next'
import { useUpdate } from '@/store/update'
import { useApp } from '@/store/app'
import { Modal } from '../ui/Modal'
import { ProgressBar } from '../ui/Controls'

export function UpdateDialog() {
  const { t } = useTranslation()
  const { status, open, dismiss } = useUpdate()
  const current = useApp((s) => s.info?.version ?? '')
  // macOS ohne Apple-Signatur kann nicht selbst installieren → Download-Seite öffnen
  const manualDownload = useApp((s) => s.info?.platform === 'darwin')
  if (!open || status.state === 'idle') return null

  const later = (
    <button type="button" className="btn" onClick={dismiss}>
      {status.state === 'available' || status.state === 'downloaded' ? t('update.later') : t('common.close')}
    </button>
  )

  let title = t('update.title')
  let body: React.ReactNode = null
  let action: React.ReactNode = null

  switch (status.state) {
    case 'checking':
      body = <p className="m-0 font-mono text-[13px] text-accent-200">[ SYSTEM ] {t('update.checking')}</p>
      break
    case 'none':
      body = <p className="m-0 font-mono text-[13px] text-accent-200">[ SYSTEM ] {t('update.none', { version: current })}</p>
      break
    case 'offline':
      body = <p className="m-0 font-mono text-[13px] text-accent-200">[ SYSTEM ] {t('update.offline')}</p>
      break
    case 'dev':
      body = <p className="m-0 font-mono text-[13px] text-accent-200">[ SYSTEM ] {t('update.dev')}</p>
      break
    case 'error':
      body = <p className="m-0 font-mono text-[13px] text-accent-200">[ SYSTEM ] {t('update.error')}</p>
      break
    case 'available':
      title = t('update.available', { version: status.version })
      body = (
        <>
          <p className="m-0 font-mono text-[13px] text-accent-100">
            [ SYSTEM ] {t('update.available', { version: status.version })} · {t('update.current', { version: current })}
          </p>
          <div className="flex flex-col gap-1.5">
            <span className="sys-label text-accent-400">[ CHANGELOG ]</span>
            <pre className="m-0 max-h-60 overflow-y-auto whitespace-pre-wrap border border-line p-3 font-body text-[13px] text-accent-200">{status.notes || t('update.noNotes')}</pre>
          </div>
          <p className="m-0 text-[12px] text-accent-400">{t('update.safe')}</p>
        </>
      )
      action = manualDownload ? (
        <button type="button" className="btn btn-primary" onClick={() => window.open('https://github.com/Lucas-S4ka1/DocForge/releases/latest', '_blank')}>
          {t('update.openDownloadPage')}
        </button>
      ) : (
        <button type="button" className="btn btn-primary" onClick={() => void window.docforge.updates.download()}>
          {t('update.download')}
        </button>
      )
      break
    case 'downloading':
      title = t('update.downloading', { version: status.version })
      body = (
        <div className="flex flex-col gap-2">
          <div className="flex font-mono text-[13px] text-accent-200">
            <span>[ SYSTEM ] {t('update.downloading', { version: status.version })}</span>
            <span className="ml-auto">{status.percent}%</span>
          </div>
          <ProgressBar value={status.percent} />
        </div>
      )
      break
    case 'downloaded':
      title = t('update.ready', { version: status.version })
      body = (
        <>
          <p className="m-0 font-mono text-[13px] text-accent-100">[ SYSTEM ] {t('update.ready', { version: status.version })}</p>
          <p className="m-0 text-[12px] text-accent-400">{t('update.backupNote')}</p>
        </>
      )
      action = (
        <button type="button" className="btn btn-primary" onClick={() => void window.docforge.updates.install()}>
          {t('update.install')}
        </button>
      )
      break
  }

  return (
    <Modal tag="SYSTEM" title={title} onClose={dismiss} width={520} footer={<>{status.state !== 'downloading' && later}{action}</>}>
      {body}
    </Modal>
  )
}
