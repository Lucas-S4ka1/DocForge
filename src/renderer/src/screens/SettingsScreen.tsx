/**
 * Einstellungen: Darstellung, Speicher & Backup, KI, Updates, About.
 * Alle Einstellungen werden lokal gespeichert und wirken sofort.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ConfirmDialog } from '@/components/ui/Modal'
import { mutate, useQuery } from '@/store/db'
import { toast } from '@/store/toast'
import { formatBytes, formatDateTime } from '@/lib/format'
import { useAction } from './archive/common'
import { useUpdate } from '@/store/update'
import { useApp } from '@/store/app'
import { languages } from '@/i18n'
import { Panel } from '@/components/ui/Panel'
import { Field, Segmented, Slider, ToggleRow } from '@/components/ui/Controls'
import { AboutContent } from '@/components/layout/AboutContent'
import type { AccentPaletteSetting, BackupInterval, FontPairSetting, Language } from '@shared/settings'

export function SettingsScreen() {
  const { t } = useTranslation()
  const settings = useApp((s) => s.settings)
  const update = useApp((s) => s.updateSettings)
  const dataPath = useApp((s) => s.info?.dataPath ?? '')
  const run = useAction()
  const checkUpdates = useUpdate((s) => s.check)
  const info = useQuery(() => window.docforge.archive.info(), []).data
  const [confirmRestore, setConfirmRestore] = useState(false)
  const lang = settings.language

  const backupNow = () =>
    run(async () => {
      const r = await mutate(() => window.docforge.archive.backupNow())
      toast.success(t('archive.backupCreated', { size: formatBytes(r.sizeBytes) }))
    })
  const restore = () =>
    run(async () => {
      const r = await mutate(() => window.docforge.archive.restoreBackup())
      if (r) toast.success(t('settings.restored'))
    })
  const chooseFolder = () =>
    run(async () => {
      const dir = await window.docforge.archive.chooseBackupFolder()
      if (dir) await update({ backupFolder: dir })
    })

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-[30px] py-[26px]">
      <header className="flex flex-col gap-1.5">
        <span className="sys-label tracking-[0.16em] text-accent-400">{t('settings.config')}</span>
        <h1 className="text-glow m-0 text-[40px] uppercase tracking-[0.02em]">{t('settings.title')}</h1>
      </header>

      <div className="grid grid-cols-3 items-start gap-5">
        {/* 01 Darstellung */}
        <Panel tag="01" title={t('settings.appearance')} className="gap-5 px-6 py-5">
          <Slider
            label={t('settings.themeIntensity')}
            value={settings.themeIntensity}
            display={`${settings.themeIntensity}%`}
            onChange={(v) => update({ themeIntensity: v })}
          />
          <ToggleRow
            title={t('settings.glow')}
            hint={t('settings.glowHint')}
            checked={settings.glowEffects}
            onChange={(v) => update({ glowEffects: v })}
            disabled={settings.reducedEffects}
          />
          <ToggleRow
            title={t('settings.reducedEffects')}
            hint={t('settings.reducedEffectsHint')}
            checked={settings.reducedEffects}
            onChange={(v) => update({ reducedEffects: v })}
          />
          <ToggleRow
            title={t('settings.scanlines')}
            hint={t('settings.scanlinesHint')}
            checked={settings.scanlines}
            onChange={(v) => update({ scanlines: v })}
            disabled={settings.reducedEffects}
          />
          <Field label={t('settings.palette')}>
            <Segmented<AccentPaletteSetting>
              ariaLabel={t('settings.palette')}
              value={settings.accentPalette}
              onChange={(v) => update({ accentPalette: v })}
              options={[
                { value: 'steel', label: t('settings.paletteSteel') },
                { value: 'neon', label: t('settings.paletteNeon') }
              ]}
            />
          </Field>
          <Field label={t('settings.fonts')}>
            <Segmented<FontPairSetting>
              ariaLabel={t('settings.fonts')}
              value={settings.fontPair}
              onChange={(v) => update({ fontPair: v })}
              options={[
                { value: 'design', label: <span style={{ fontFamily: 'Barlow Condensed' }}>Barlow</span> },
                { value: 'rajdhani', label: <span style={{ fontFamily: 'Rajdhani' }}>Rajdhani · Inter</span> },
                { value: 'exo', label: <span style={{ fontFamily: "'Exo 2'" }}>Exo 2 · Inter</span> }
              ]}
            />
          </Field>
          <Field label={t('settings.language')}>
            <Segmented<Language>
              ariaLabel={t('settings.language')}
              value={settings.language}
              onChange={(v) => update({ language: v })}
              options={languages.map((l) => ({ value: l.code, label: l.label }))}
            />
          </Field>
        </Panel>

        {/* 02 Speicher & Backup */}
        <div className="flex flex-col gap-5">
          <Panel tag="02" title={t('settings.storage')} className="gap-5 px-6 py-5">
            <Field label={t('settings.dataLocation')}>
              <div className="flex gap-2">
                <div className="input flex items-center truncate font-mono text-[13px]" title={dataPath}>
                  {dataPath}
                </div>
                <button type="button" className="btn flex-none" onClick={() => void window.docforge.app.openDataFolder()}>
                  {t('settings.openFolder')}
                </button>
              </div>
            </Field>
            <Field label={t('settings.autoBackup')}>
              <Segmented<BackupInterval>
                ariaLabel={t('settings.autoBackup')}
                value={settings.autoBackup}
                onChange={(v) => update({ autoBackup: v })}
                options={[
                  { value: 'off', label: t('settings.backupOff') },
                  { value: 'daily', label: t('settings.backupDaily') },
                  { value: 'weekly', label: t('settings.backupWeekly') }
                ]}
              />
            </Field>
            <Field label={t('settings.backupFolder')}>
              <div className="flex gap-2">
                <div className="input flex items-center truncate font-mono text-[13px]" title={settings.backupFolder || `${dataPath}/backups`}>
                  {settings.backupFolder || `${dataPath}/backups`}
                </div>
                <button type="button" className="btn flex-none" onClick={chooseFolder}>
                  {t('settings.change')}
                </button>
              </div>
            </Field>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary" onClick={backupNow}>
                {t('settings.backupNow')}
              </button>
              <button type="button" className="btn" onClick={() => setConfirmRestore(true)}>
                {t('settings.restore')}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => void window.docforge.archive.openBackupFolder()}>
                {t('settings.openFolder')}
              </button>
            </div>
            <span className="font-mono text-[12px] text-accent-400">
              {t('archive.lastBackup')} {info?.lastBackupAt ? formatDateTime(info.lastBackupAt, lang) : t('archive.never')}
              {info ? ` · DB ${formatBytes(info.sizeBytes)} · Schema v${info.schemaVersion}` : ''}
            </span>
            <p className="m-0 text-[12px] text-accent-400">{t('settings.privacy')}</p>
          </Panel>

          {/* 03 KI */}
          <Panel tag="03" title={t('settings.ai')} className="gap-4 px-6 py-5">
            <Field label={t('settings.apiKey')}>
              <input className="input" type="password" placeholder="sk-ant-…" disabled />
            </Field>
            <p className="m-0 text-[12px] text-accent-400">
              {t('settings.apiKeyHint')} · {t('common.comingInPhase', { phase: 5 })}
            </p>
          </Panel>

          {/* 04 Updates */}
          <Panel tag="04" title={t('settings.updates')} className="gap-4 px-6 py-5">
            <ToggleRow
              title={t('settings.checkOnStart')}
              hint={t('settings.checkOnStartHint')}
              checked={settings.checkUpdatesOnStart}
              onChange={(v) => update({ checkUpdatesOnStart: v })}
            />
            <button type="button" className="btn self-start" onClick={checkUpdates}>
              {t('settings.checkUpdates')}
            </button>
          </Panel>
        </div>

        {/* About */}
        <AboutContent />
      </div>
      {confirmRestore && (
        <ConfirmDialog
          title={t('settings.restoreTitle')}
          text={t('settings.restoreText')}
          confirmLabel={t('settings.restoreConfirm')}
          onCancel={() => setConfirmRestore(false)}
          onConfirm={() => {
            setConfirmRestore(false)
            void restore()
          }}
        />
      )}
    </main>
  )
}
