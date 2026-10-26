import type { DocForgeApi } from '@shared/ipc'

declare global {
  interface Window {
    docforge: DocForgeApi
  }
}

export {}
