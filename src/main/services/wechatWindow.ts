// src/main/services/wechatWindow.ts

import { windowManager } from 'node-window-manager'
import { delay } from '../utils/delay'

const PLATFORM_DELAY = process.platform === 'win32' ? 800 : 500

export function isWeChatWindow(win: any): boolean {
  if (!win) return false
  const title = win.getTitle() || ''
  return title === '企业微信'
}

export async function waitForWeChatActive(timeoutMs: number = 0): Promise<any> {
  const startedAt = Date.now()

  while (true) {
    const activeWin = windowManager.getActiveWindow()
    if (activeWin && isWeChatWindow(activeWin)) return activeWin

    if (timeoutMs > 0 && Date.now() - startedAt > timeoutMs) {
      throw new Error('等待企业微信/微信窗口激活超时')
    }

    await delay(PLATFORM_DELAY)
  }
}

export async function activateWeChatWindow(): Promise<void> {
  console.log('[DEBUG] activateWeChatWindow 开始')

  const windows = windowManager.getWindows()
  console.log(`[DEBUG] 找到 ${windows.length} 个窗口`)

  const wechatWindow = windows.find(isWeChatWindow)
  if (!wechatWindow) {
    console.log('[DEBUG] 未找到企业微信窗口')
    throw new Error('未找到企业微信/微信窗口')
  }

  console.log(`[DEBUG] 找到企业微信窗口: "${wechatWindow.getTitle()}"`)

  // 检查当前是否已经是企业微信窗口
  const currentActive = windowManager.getActiveWindow()
  if (currentActive && isWeChatWindow(currentActive)) {
    console.log('[DEBUG] 企业微信已经是当前活动窗口')
    return
  }

  // Windows 需要更强力的窗口激活方式
  if (process.platform === 'win32') {
    console.log('[DEBUG] Windows 平台，开始激活流程')

    for (let attempt = 1; attempt <= 3; attempt++) {
      console.log(`[DEBUG] 第 ${attempt} 次尝试激活`)

      try {
        wechatWindow.restore()
        console.log('[DEBUG] restore() 成功')
      } catch (e: any) {
        console.log(`[DEBUG] restore() 失败: ${e.message}`)
      }

      await delay(200)

      try {
        wechatWindow.maximize()
        await delay(100)
        wechatWindow.restore()
        console.log('[DEBUG] maximize->restore 成功')
      } catch (e: any) {
        console.log(`[DEBUG] maximize 失败: ${e.message}`)
      }

      await delay(200)

      try {
        wechatWindow.bringToTop()
        console.log('[DEBUG] bringToTop() 成功')
      } catch (e: any) {
        console.log(`[DEBUG] bringToTop() 失败: ${e.message}`)
      }

      await delay(500)

      const newActive = windowManager.getActiveWindow()
      if (newActive && isWeChatWindow(newActive)) {
        console.log(`[DEBUG] 第 ${attempt} 次尝试成功，企业微信已激活`)
        return
      }
    }

    console.log('[DEBUG] 等待窗口激活确认')
    await waitForWeChatActive(5000)
    console.log('[DEBUG] 窗口已成功激活')
  } else {
    // Mac 平台
    wechatWindow.bringToTop()
    await delay(500)
    await waitForWeChatActive(5000)
    console.log('[DEBUG] 窗口已成功激活')
  }
}