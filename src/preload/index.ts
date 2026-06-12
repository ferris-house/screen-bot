// src/preload/index.ts

import { contextBridge, ipcRenderer } from 'electron'
import type { IpcApi } from '@shared/types'

const ipcApi: IpcApi = {
  invoke: (channel, data) => ipcRenderer.invoke(channel, data),

  on: (channel, handler) => {
    const listener = (event: Electron.IpcRendererEvent, data: any) => handler(data)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },

  send: (channel, data) => ipcRenderer.send(channel, data)
}

contextBridge.exposeInMainWorld('electron', {
  ipc: ipcApi,
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url)
  }
})