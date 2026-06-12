// src/main/ipc/queueHandler.ts

import { ipcMain, BrowserWindow } from 'electron'
import { startQueueAgent, stopQueueAgent, getQueueAgentStatus } from '../services/queuePoller'

let mainWindow: BrowserWindow | null = null

export function registerQueueHandlers(win: BrowserWindow): void {
  mainWindow = win

  ipcMain.handle('queue-agent:start', async (event, config) => {
    try {
      startQueueAgent(config, mainWindow!)
      return { success: true, status: getQueueAgentStatus() }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        status: getQueueAgentStatus()
      }
    }
  })

  ipcMain.handle('queue-agent:stop', async () => {
    stopQueueAgent()
    return { success: true, status: getQueueAgentStatus() }
  })

  ipcMain.handle('queue-agent:get-status', async () => {
    return { status: getQueueAgentStatus() }
  })
}