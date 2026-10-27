/**
 * Einstellungen des Kamera-Studios (bleiben während der Sitzung erhalten).
 */
import { create } from 'zustand'
import { neutralAdjustments, type Adjustments, type BackgroundMode, type CropPreset } from '@/camera/pipeline'

export type TimerSeconds = 0 | 3 | 5 | 10

interface StudioState {
  deviceId: string | null
  /** gewünschte Höhe (720/1080/1440/2160) oder 0 = Maximum */
  resolution: number
  timer: TimerSeconds
  burst: boolean
  mirror: boolean
  thirds: boolean
  silhouette: boolean
  headFrame: boolean
  crop: CropPreset
  adjust: Adjustments
  background: BackgroundMode
  bgColor: string
  format: 'png' | 'jpeg'
  set(patch: Partial<Omit<StudioState, 'set' | 'setAdjust'>>): void
  setAdjust(patch: Partial<Adjustments>): void
}

export const useStudio = create<StudioState>((set, get) => ({
  deviceId: null,
  resolution: 0,
  timer: 3,
  burst: false,
  mirror: true,
  thirds: true,
  silhouette: true,
  headFrame: true,
  crop: 'cv',
  adjust: neutralAdjustments,
  background: 'original',
  bgColor: '#c8d2dc',
  format: 'jpeg',
  set: (patch) => set(patch),
  setAdjust: (patch) => set({ adjust: { ...get().adjust, ...patch } })
}))
