// src/preload/preload.ts.d.ts

import type { IpcApi } from '@shared/types'

declare global {
  interface Window {
    electron: {
      ipc: IpcApi
      shell: {
        openExternal: (url: string) => Promise<void>
      }
    }
  }
}

export {}