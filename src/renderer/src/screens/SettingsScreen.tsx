/**
 * Einstellungen: Darstellung, Speicher & Backup, KI, Updates, About.
 * Darstellung/Sprache sind in Phase 1 voll funktionsfähig und werden lokal gespeichert.
 */
import { useTranslation } from 'react-i18next'
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
            <div className="flex gap-2">
              <button type="button" className="btn btn-primary" disabled title={t('common.comingInPhase', { phase: 2 })}>
                {t('settings.backupNow')}
              </button>
              <button type="button" className="btn" disabled title={t('common.comingInPhase', { phase: 2 })}>
                {t('settings.restore')}
              </button>
            </div>
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
          </Panel>
        </div>

        {/* About */}
        <AboutContent />
      </div>
    </main>
  )
}
