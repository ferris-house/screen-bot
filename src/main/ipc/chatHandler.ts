// src/main/ipc/chatHandler.ts

import { ipcMain } from 'electron'
import { openChatByName, sendToWeChat } from '../services/wechatAutomation'

export function registerChatHandlers(): void {
  ipcMain.handle('open-chat', async (event, { target }) => {
    console.log('🔍 调试 - IPC open-chat 被调用，目标:', target)
    try {
      await openChatByName(target)
      console.log('🔍 调试 - openChatByName 执行成功')
      return { success: true }
    } catch (e: any) {
      console.log('🔍 调试 - openChatByName 执行失败，错误:', e)
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('send-item', async (event, item) => {
    console.log('🔍 调试 - IPC send-item 被调用，参数:', item)
    try {
      await sendToWeChat(item)
      console.log('🔍 调试 - sendToWeChat 执行成功')
      return { success: true }
    } catch (e: any) {
      console.log('🔍 调试 - sendToWeChat 执行失败，错误:', e)
      return { success: false, error: e.message }
    }
  })
}