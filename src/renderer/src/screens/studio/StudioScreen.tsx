/**
 * Kamera-Studio (Design 1d): Live-Vorschau in höchster Auflösung, Overlays, Countdown,
 * Serienbild, Spiegeln, Anpassungen, Hintergrund (lokal per MediaPipe), Zuschnitt-Vorlagen
 * und Galerie mit "Im Lebenslauf verwenden".
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Photo } from '@shared/models'
import {
  composite,
  cropAspect,
  cropRect,
  filterParams,
  grab,
  isNeutral,
  warmthKelvin,
  type BackgroundMode,
  type CropPreset
} from '@/camera/pipeline'
import { getSegmenter, segmentImage, segmentVideo } from '@/camera/segmenter'
import { useStudio, type TimerSeconds } from '@/store/studio'
import { useApp } from '@/store/app'
import { db, mutate, useQuery } from '@/store/db'
import { toast } from '@/store/toast'
import { applyPhotoToCv } from '@/lib/applyPhotoToCv'
import { Corners } from '@/components/ui/Panel'
import { Segmented, Slider, ToggleRow } from '@/components/ui/Controls'
import { ConfirmDialog } from '@/components/ui/Modal'
import { TopBar, AsideLabel } from '@/components/layout/TopBar'
import { useAction } from '../archive/common'
import { resolutions, useCamera } from './useCamera'

/** Unsichtbarer SVG-Filter für Helligkeit/Kontrast/Wärme/Schärfe (Vorschau + Aufnahme). */
function AdjustFilter() {
  const adjust = useStudio((s) => s.adjust)
  const p = filterParams(adjust)
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <filter id="df-cam" colorInterpolationFilters="sRGB">
        <feComponentTransfer>
          <feFuncR type="linear" slope={p.slope} intercept={p.intercept} />
          <feFuncG type="linear" slope={p.slope} intercept={p.intercept} />
          <feFuncB type="linear" slope={p.slope} intercept={p.intercept} />
        </feComponentTransfer>
        <feColorMatrix type="matrix" values={p.matrix} />
        <feConvolveMatrix order="3" kernelMatrix={p.kernel} preserveAlpha="true" edgeMode="duplicate" />
      </filter>
    </svg>
  )
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function StudioScreen() {
  const { t } = useTranslation()
  const studio = useStudio()
  const profileId = useApp((s) => s.settings.activeProfileId)
  const run = useAction()
  const cam = useCamera(studio.deviceId, studio.resolution)
  const photos = useQuery(() => db.photos.list(profileId), [profileId]).data ?? []

  const displayRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [stage, setStage] = useState({ w: 0, h: 0 })
  const work = useRef({ frame: document.createElement('canvas'), small: document.createElement('canvas'), mask: document.createElement('canvas'), scratch: document.createElement('canvas') })
  const [segState, setSegState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [countdown, setCountdown] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState(false)
  const [selected, setSelected] = useState<number | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const live = cam.status === 'live'

  // Verfügbare Fläche messen → Vorschau exakt ins Seitenverhältnis der Kamera einpassen
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setStage({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const needsSeg = studio.background !== 'original'

  // Segmentierungsmodell bei Bedarf laden
  useEffect(() => {
    if (!needsSeg || segState !== 'idle') return
    setSegState('loading')
    getSegmenter('VIDEO')
      .then(() => setSegState('ready'))
      .catch(() => setSegState('error'))
  }, [needsSeg, segState])

  // Render-Schleife der Live-Vorschau
  useEffect(() => {
    if (!live) return
    let raf = 0
    let alive = true
    let segmenter: Awaited<ReturnType<typeof getSegmenter>> | null = null
    if (needsSeg && segState === 'ready') void getSegmenter('VIDEO').then((s) => (segmenter = s))
    const loop = () => {
      if (!alive) return
      const v = cam.videoRef.current
      const out = displayRef.current
      const st = useStudio.getState()
      if (v && out && v.videoWidth) {
        const scale = Math.min(1, 1280 / v.videoWidth)
        const { frame, small, mask, scratch } = work.current
        grab(v, v.videoWidth, { x: 0, y: 0, w: v.videoWidth, h: v.videoHeight }, st.mirror, frame, scale)
        let hasMask = false
        if (st.background !== 'original' && segmenter) {
          grab(frame, frame.width, { x: 0, y: 0, w: frame.width, h: frame.height }, false, small, 384 / frame.width)
          try {
            hasMask = segmentVideo(segmenter, small, performance.now(), mask)
          } catch {
            // Erkennung nicht möglich (z. B. kein WebGL) → ohne Hintergrund-Effekt weiter
            segmenter = null
            setSegState('error')
          }
        }
        composite(out, frame, hasMask ? mask : null, st.background, st.bgColor, scratch)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      alive = false
      cancelAnimationFrame(raf)
    }
  }, [live, needsSeg, segState, cam.videoRef])

  /** Ein Foto in voller Auflösung aufnehmen, verarbeiten und speichern. */
  const captureOne = useCallback(
    async (label: string) => {
      const v = cam.videoRef.current
      if (!v || !v.videoWidth) return null
      const st = useStudio.getState()
      const rect = cropRect(st.crop, v.videoWidth, v.videoHeight)
      const crop = document.createElement('canvas')
      // Gespeichert wird immer seitenrichtig (Schrift lesbar) – gespiegelt ist nur die Vorschau.
      // Der Zuschnitt ist zentriert, daher deckt er sich mit dem gespiegelten Vorschaurahmen.
      grab(v, v.videoWidth, rect, false, crop)
      let result = crop
      if (st.background !== 'original') {
        try {
          const seg = await getSegmenter('IMAGE')
          const mask = document.createElement('canvas')
          const out = document.createElement('canvas')
          if (segmentImage(seg, crop, mask)) {
            composite(out, crop, mask, st.background, st.bgColor, document.createElement('canvas'))
            result = out
          }
        } catch {
          toast.error(t('studio.segError'))
        }
      }
      // Anpassungen in voller Qualität anwenden
      const final = document.createElement('canvas')
      final.width = result.width
      final.height = result.height
      const ctx = final.getContext('2d')!
      ctx.filter = isNeutral(st.adjust) ? 'none' : 'url(#df-cam)'
      ctx.drawImage(result, 0, 0)
      const mimeType = st.format === 'png' ? 'image/png' : 'image/jpeg'
      const blob = await new Promise<Blob | null>((res) => final.toBlob(res, mimeType, 0.95))
      if (!blob) return null
      const data = new Uint8Array(await blob.arrayBuffer())
      return window.docforge.photos.saveCaptured({ data, format: st.format, width: final.width, height: final.height, profileId, label })
    },
    [cam.videoRef, profileId]
  )

  const capture = (burst: boolean) =>
    run(async () => {
      if (busy || !live) return
      setBusy(true)
      try {
        for (let s = studio.timer; s > 0; s--) {
          setCountdown(s)
          await sleep(1000)
        }
        setCountdown(null)
        const shots = burst ? 5 : 1
        let last: Photo | null = null
        for (let i = 0; i < shots; i++) {
          setFlash(true)
          setTimeout(() => setFlash(false), 120)
          last = await captureOne(t(`studio.cropLabel.${studio.crop}`))
          if (i < shots - 1) await sleep(250)
        }
        await mutate(async () => undefined)
        if (last) {
          setSelected(last.id)
          toast.success(t(burst ? 'studio.savedBurst' : 'studio.saved', { n: shots, size: `${last.width}×${last.height}` }))
        }
      } finally {
        setCountdown(null)
        setBusy(false)
      }
    })

  const current = photos.find((p) => p.id === selected) ?? null
  const currentIndex = current ? photos.length - photos.indexOf(current) : 0

  const applyToCv = () =>
    run(async () => {
      if (!current) return
      const r = await applyPhotoToCv(current.fileName)
      if (r === 'no-profile') toast.error(t('archive.needProfile'))
      else toast.success(t('studio.usedInCv'))
    })

  // Overlay-Geometrie (normiert) für die Vorschau
  const vw = cam.info?.width || 16
  const vh = cam.info?.height || 9
  const fit = Math.min((stage.w - 24) / vw, (stage.h - 24) / vh)
  const viewW = Math.max(0, Math.floor(vw * fit))
  const viewH = Math.max(0, Math.floor(vh * fit))
  const r = cropRect(studio.crop, vw, vh)
  const pct = (v: number, total: number) => `${(v / total) * 100}%`
  const statusText =
    cam.status === 'live' && cam.info
      ? `${cam.info.width}×${cam.info.height} · ${cam.info.fps} fps · ${t('studio.processedLocally')}`
      : t(`studio.status.${cam.status}`)

  return (
    <>
      <AdjustFilter />
      <TopBar>
        <span className="font-heading text-[18px] font-semibold uppercase leading-none tracking-[0.06em] text-accent-100">{t('studio.title')}</span>
        {cam.devices.length > 0 && (
          <select
            className="input h-[32px] min-h-0 w-auto max-w-[220px] cursor-pointer bg-ground py-0 text-[13px]"
            value={studio.deviceId ?? cam.devices[0]?.deviceId}
            onChange={(e) => studio.set({ deviceId: e.target.value })}
            aria-label={t('studio.device')}
          >
            {cam.devices.map((d, i) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `${t('studio.camera')} ${i + 1}`}
              </option>
            ))}
          </select>
        )}
        {live && (
          <Segmented<string>
            ariaLabel={t('studio.resolution')}
            value={String(studio.resolution)}
            onChange={(v) => studio.set({ resolution: Number(v) })}
            options={[
              ...resolutions.filter((x) => x.height <= (cam.info?.maxHeight ?? 1080)).map((x) => ({ value: String(x.height), label: x.label })),
              { value: '0', label: 'Max' }
            ]}
          />
        )}
        <span className="ml-auto font-mono text-[12px] text-accent-400">{statusText}</span>
        {live && (
          <button type="button" className="btn ml-2" onClick={cam.stop}>
            {t('studio.stopCamera')}
          </button>
        )}
      </TopBar>

      <div className="flex min-h-0 flex-1">
        {/* Links: Aufnahme, Overlays, Zuschnitt */}
        <aside className="flex w-[240px] flex-none flex-col gap-[18px] overflow-y-auto border-r border-line px-4 py-[18px]">
          <div className="flex flex-col gap-2.5">
            <AsideLabel>{t('studio.capture')}</AsideLabel>
            <span className="text-[12px] text-accent-300">{t('studio.timer')}</span>
            <Segmented<string>
              ariaLabel={t('studio.timer')}
              value={String(studio.timer)}
              onChange={(v) => studio.set({ timer: Number(v) as TimerSeconds })}
              options={[
                { value: '0', label: t('studio.off') },
                { value: '3', label: '3 s' },
                { value: '5', label: '5 s' },
                { value: '10', label: '10 s' }
              ]}
            />
            <ToggleRow title={t('studio.burst')} checked={studio.burst} onChange={(v) => studio.set({ burst: v })} />
            <ToggleRow title={t('studio.mirror')} checked={studio.mirror} onChange={(v) => studio.set({ mirror: v })} />
            <span className="text-[12px] text-accent-300">{t('studio.format')}</span>
            <Segmented<'jpeg' | 'png'>
              ariaLabel={t('studio.format')}
              value={studio.format}
              onChange={(v) => studio.set({ format: v })}
              options={[
                { value: 'jpeg', label: 'JPEG 95 %' },
                { value: 'png', label: 'PNG' }
              ]}
            />
          </div>
          <div className="flex flex-col gap-2.5">
            <AsideLabel>{t('studio.overlays')}</AsideLabel>
            <ToggleRow title={t('studio.thirds')} checked={studio.thirds} onChange={(v) => studio.set({ thirds: v })} />
            <ToggleRow title={t('studio.silhouette')} checked={studio.silhouette} onChange={(v) => studio.set({ silhouette: v })} />
            <ToggleRow title={t('studio.headFrame')} checked={studio.headFrame} onChange={(v) => studio.set({ headFrame: v })} />
          </div>
          <div className="flex flex-col gap-2">
            <AsideLabel>{t('studio.crop')}</AsideLabel>
            {(['cv', 'passport', 'square'] as CropPreset[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => studio.set({ crop: c })}
                className={`flex items-center gap-3 border px-3 py-2.5 text-left text-[14px] ${
                  studio.crop === c ? 'border-accent-400 bg-accent-500/15 text-accent-100 shadow-glow-sm' : 'border-line text-accent-200 hover:border-accent-500'
                }`}
              >
                <span className="h-3.5 w-3.5 flex-none border border-accent-400" style={{ aspectRatio: cropAspect[c], width: 'auto' }} />
                <span className="flex-1">{t(`studio.cropLabel.${c}`)}</span>
                <span className="text-[12px] text-accent-400">{t(`studio.cropRatio.${c}`)}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* Mitte: Live-Vorschau + Galerie */}
        <div className="flex min-w-0 flex-1 flex-col gap-3 p-5">
          <div ref={stageRef} className="blueprint relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-void/80">
            <Corners />
            <video ref={cam.videoRef} className="hidden" playsInline muted />
            {live ? (
              <div className="relative" style={{ width: viewW, height: viewH }}>
                <canvas
                  ref={displayRef}
                  className="h-full w-full"
                  style={{ filter: isNeutral(studio.adjust) ? undefined : 'url(#df-cam)' }}
                />
                {/* Abdunklung außerhalb des Zuschnitts */}
                <div
                  className="pointer-events-none absolute border border-accent-300 shadow-[0_0_0_9999px_rgba(5,7,13,0.45)]"
                  style={{ left: pct(r.x, vw), top: pct(r.y, vh), width: pct(r.w, vw), height: pct(r.h, vh) }}
                >
                  <span className="absolute -top-6 left-0 font-heading text-[11px] font-semibold uppercase tracking-system text-accent-200">
                    {t(`studio.cropLabel.${studio.crop}`)} · {t(`studio.cropRatio.${studio.crop}`)}
                  </span>
                  {studio.thirds && (
                    <>
                      {[1, 2].map((i) => (
                        <span key={`v${i}`} className="absolute inset-y-0 w-px bg-white/25" style={{ left: `${(i * 100) / 3}%` }} />
                      ))}
                      {[1, 2].map((i) => (
                        <span key={`h${i}`} className="absolute inset-x-0 h-px bg-white/25" style={{ top: `${(i * 100) / 3}%` }} />
                      ))}
                    </>
                  )}
                  {studio.silhouette && (
                    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 133" preserveAspectRatio="none" aria-hidden="true">
                      <ellipse cx="50" cy="44" rx="17" ry="22" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="0.5" strokeDasharray="1.6 1.2" />
                      <path d="M 6 133 C 8 98, 30 84, 50 84 C 70 84, 92 98, 94 133" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="0.5" strokeDasharray="1.6 1.2" />
                    </svg>
                  )}
                  {studio.headFrame && (
                    // Kopfposition: Kinn-zu-Scheitel etwa 50–70 % der Bildhöhe (biometrische Vorgabe Passbild)
                    <span className="absolute left-[30%] right-[30%] top-[14%] h-[6%] border border-b-0 border-white/60" />
                  )}
                </div>
                {countdown !== null && (
                  <span className="text-glow absolute inset-0 grid place-items-center font-heading text-[160px] font-semibold text-accent-100">{countdown}</span>
                )}
                {flash && <span className="absolute inset-0 bg-white/80" />}
                <span className="absolute left-4 top-4 flex items-center gap-2 font-heading text-[12px] font-semibold uppercase tracking-label text-accent-100">
                  <span className="h-2 w-2 bg-accent-300 shadow-glow-dot" />
                  LIVE · {cam.info ? (cam.info.height >= 2160 ? '4K' : `${cam.info.height}p`) : ''}
                </span>
                {needsSeg && segState !== 'ready' && (
                  <span className="absolute right-4 top-4 font-mono text-[12px] text-accent-200">
                    {segState === 'error' ? t('studio.segError') : t('studio.segLoading')}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex max-w-md flex-col items-center gap-4 text-center">
                <span className="flex items-center gap-2 font-heading text-[12px] font-semibold uppercase tracking-label text-accent-400">
                  <span className={`h-2 w-2 border ${cam.status === 'starting' ? 'animate-caret border-accent-300 bg-accent-300' : 'border-accent-500'}`} />
                  {t(`studio.status.${cam.status}`)}
                </span>
                <p className="m-0 text-[13px] text-accent-300">{t(`studio.hint.${cam.status}`)}</p>
                {cam.status !== 'starting' && (
                  <button type="button" className="btn btn-primary" onClick={cam.start}>
                    {t('studio.startCamera')}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Galerie + Aufnahme */}
          <div className="flex h-[96px] flex-none items-stretch gap-2">
            <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto">
              {photos.length === 0 && <span className="self-center text-[12px] text-accent-500">{t('studio.galleryEmpty')}</span>}
              {photos.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelected(p.id)}
                  className={`relative h-full flex-none border ${p.id === selected ? 'border-accent-300 shadow-glow-sm' : 'border-line hover:border-accent-500'}`}
                  style={{ aspectRatio: `${p.width} / ${p.height}` }}
                >
                  <img src={`docforge-photo://${encodeURIComponent(p.fileName)}`} alt="" className="h-full w-full object-cover" loading="lazy" />
                  <span className="absolute bottom-1 left-1.5 font-mono text-[10px] text-white [text-shadow:0_0_3px_#000]">#{String(photos.length - i).padStart(2, '0')}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={!live || busy}
              onClick={() => void capture(false)}
              className="blueprint grid w-[68px] flex-none place-items-center border-accent-400 shadow-glow disabled:opacity-40"
              aria-label={t('studio.shoot')}
              title={t('studio.shoot')}
            >
              <Corners />
              <span className="h-10 w-10 bg-accent-500" />
            </button>
            <div className="flex w-[190px] flex-none flex-col justify-center gap-2">
              <button type="button" className="btn" disabled={!live || busy} onClick={() => void capture(true)}>
                {t('studio.burstShot')}
              </button>
              <button type="button" className="btn btn-primary" disabled={!current} onClick={() => void applyToCv()}>
                {current ? t('studio.useInCv', { n: String(currentIndex).padStart(2, '0') }) : t('studio.useInCvNone')}
              </button>
            </div>
          </div>
        </div>

        {/* Rechts: Anpassen + Hintergrund */}
        <aside className="flex w-[272px] flex-none flex-col gap-[18px] overflow-y-auto border-l border-line px-4 py-[18px]">
          <AsideLabel>{t('studio.adjust')}</AsideLabel>
          <Slider label={t('studio.brightness')} min={-50} max={50} value={studio.adjust.brightness} display={`${studio.adjust.brightness > 0 ? '+' : ''}${studio.adjust.brightness}`} onChange={(v) => studio.setAdjust({ brightness: v })} />
          <Slider label={t('studio.contrast')} min={-50} max={50} value={studio.adjust.contrast} display={`${studio.adjust.contrast > 0 ? '+' : ''}${studio.adjust.contrast}`} onChange={(v) => studio.setAdjust({ contrast: v })} />
          <Slider label={t('studio.warmth')} min={-50} max={50} value={studio.adjust.warmth} display={`${warmthKelvin(studio.adjust.warmth)} K`} onChange={(v) => studio.setAdjust({ warmth: v })} />
          <Slider label={t('studio.sharpness')} min={0} max={100} value={studio.adjust.sharpness} onChange={(v) => studio.setAdjust({ sharpness: v })} />
          {!isNeutral(studio.adjust) && (
            <button type="button" className="btn btn-ghost self-start text-[12px]" onClick={() => studio.setAdjust({ brightness: 0, contrast: 0, warmth: 0, sharpness: 0 })}>
              {t('studio.reset')}
            </button>
          )}

          <AsideLabel>{t('studio.background')}</AsideLabel>
          <div className="grid grid-cols-2 gap-2">
            {(['original', 'blur', 'solid', 'studio'] as BackgroundMode[]).map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => studio.set({ background: b })}
                className={`flex flex-col gap-1.5 border p-1.5 text-left text-[12px] ${
                  studio.background === b ? 'border-accent-400 bg-accent-500/15 text-accent-100' : 'border-line text-accent-200 hover:border-accent-500'
                }`}
              >
                <span
                  className="h-10"
                  style={{
                    background:
                      b === 'original'
                        ? 'radial-gradient(#7a7a7d,#424244)'
                        : b === 'blur'
                          ? '#5d5d60'
                          : b === 'solid'
                            ? studio.bgColor
                            : 'radial-gradient(circle at 50% 35%,#a3a5a8,#6c6e72)',
                    filter: b === 'blur' ? 'blur(2px)' : undefined
                  }}
                />
                {t(`studio.bg.${b}`)}
              </button>
            ))}
          </div>
          {studio.background === 'solid' && (
            <label className="flex items-center gap-2 text-[12px] text-accent-300">
              <input type="color" value={studio.bgColor} onChange={(e) => studio.set({ bgColor: e.target.value })} className="h-7 w-10 cursor-pointer bg-transparent" />
              {t('studio.bgColor')}
            </label>
          )}
          <p className="m-0 text-[11.5px] text-accent-500">{t('studio.privacy')}</p>

          {current && (
            <>
              <AsideLabel>{t('studio.selected')}</AsideLabel>
              <img src={`docforge-photo://${encodeURIComponent(current.fileName)}`} alt="" className="w-full border border-line" />
              <span className="font-mono text-[11.5px] text-accent-300">
                #{String(currentIndex).padStart(2, '0')} · {current.width}×{current.height} · {current.format.toUpperCase()}
              </span>
              <button type="button" className="btn self-start text-[12px] hover:border-danger/70 hover:text-danger" onClick={() => setConfirmDelete(true)}>
                {t('common.delete')}
              </button>
            </>
          )}
        </aside>
      </div>

      {confirmDelete && current && (
        <ConfirmDialog
          title={t('archive.deletePhoto')}
          text={t('archive.deletePhotoText')}
          confirmLabel={t('common.delete')}
          danger
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            setConfirmDelete(false)
            const ok = await run(async () => (await mutate(() => db.photos.remove(current.id)), true), t('archive.deleted'))
            if (ok) setSelected(null)
          }}
        />
      )}
    </>
  )
}
