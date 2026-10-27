/**
 * Kamera-Zugriff: startet erst nach ausdrücklichem Klick, wählt die höchste unterstützte
 * Auflösung, listet Kameras und meldet einen klaren Status.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

export type CameraStatus = 'off' | 'starting' | 'live' | 'denied' | 'nodevice' | 'error'

export interface CameraInfo {
  width: number
  height: number
  fps: number
  /** maximale Höhe laut Kamera (für die Auflösungsauswahl) */
  maxHeight: number
}

export const resolutions = [
  { height: 720, width: 1280, label: '720p' },
  { height: 1080, width: 1920, label: '1080p' },
  { height: 1440, width: 2560, label: '1440p' },
  { height: 2160, width: 3840, label: '4K' }
]

export function useCamera(deviceId: string | null, resolution: number) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [status, setStatus] = useState<CameraStatus>('off')
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [info, setInfo] = useState<CameraInfo | null>(null)
  const wantedRef = useRef(false)

  const stop = useCallback(() => {
    wantedRef.current = false
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setStatus('off')
    setInfo(null)
  }, [])

  const open = useCallback(async () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    setStatus('starting')
    try {
      if (!(await window.docforge.camera.requestAccess())) {
        setStatus('denied')
        return
      }
      // Höchste Auflösung anfragen; der Browser liefert das Beste, was die Kamera kann
      const target = resolutions.find((r) => r.height === resolution) ?? resolutions[resolutions.length - 1]
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: resolution ? target.width : 4096 },
          height: { ideal: resolution ? target.height : 2160 },
          frameRate: { ideal: 30 }
        }
      })
      if (!wantedRef.current) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      streamRef.current = stream
      const track = stream.getVideoTracks()[0]
      const s = track.getSettings()
      const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities
      setInfo({ width: s.width ?? 0, height: s.height ?? 0, fps: Math.round(s.frameRate ?? 0), maxHeight: caps.height?.max ?? s.height ?? 1080 })
      const v = videoRef.current
      if (v) {
        v.srcObject = stream
        await v.play().catch(() => undefined)
      }
      setDevices((await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput'))
      setStatus('live')
    } catch (e) {
      const name = e instanceof DOMException ? e.name : ''
      setStatus(name === 'NotAllowedError' ? 'denied' : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'nodevice' : 'error')
    }
  }, [deviceId, resolution])

  const start = useCallback(() => {
    wantedRef.current = true
    void open()
  }, [open])

  // Gerät/Auflösung geändert, während die Kamera läuft → neu verbinden
  useEffect(() => {
    if (wantedRef.current) void open()
  }, [open])

  // Beim Verlassen des Screens Kamera immer ausschalten
  useEffect(() => stop, [stop])

  return { videoRef, status, devices, info, start, stop }
}
