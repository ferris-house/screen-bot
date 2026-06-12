// src/main/ipc/index.ts

import { ipcMain, shell, BrowserWindow } from 'electron'
import { registerChatHandlers } from './chatHandler'
import { registerQueueHandlers } from './queueHandler'

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  registerChatHandlers()
  registerQueueHandlers(mainWindow)

  // Shell 处理器
  ipcMain.handle('shell:open-external', async (event, url: string) => {
    await shell.openExternal(url)
  })
}