// src/main/services/wechatWindow.ts

import { windowManager } from 'node-window-manager'
import { delay } from '../utils/delay'

export function isWeChatWindow(win: any): boolean {
  if (!win) return false
  const title = win.getTitle() || ''
  return title === '企业微信'
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

    try {
      wechatWindow.restore()
      console.log('[DEBUG] restore() 成功')
    } catch (e: any) {
      console.log(`[DEBUG] restore() 失败: ${e.message}`)
    }

    await delay(200)

    try {
      wechatWindow.bringToTop()
      console.log('[DEBUG] bringToTop() 成功')
    } catch (e: any) {
      console.log(`[DEBUG] bringToTop() 失败: ${e.message}`)
    }

    await delay(500)

    // 验证激活结果
    const activeWin = windowManager.getActiveWindow()
    if (!activeWin || !isWeChatWindow(activeWin)) {
      console.log('[DEBUG] 窗口激活失败')
      throw new Error('无法激活企业微信窗口，请检查窗口是否被最小化或隐藏')
    }

    console.log('[DEBUG] 窗口激活成功')
  } else {
    // Mac 平台
    console.log('[DEBUG] macOS 平台，开始激活流程')

    try {
      wechatWindow.bringToTop()
      console.log('[DEBUG] bringToTop() 成功')
    } catch (e: any) {
      console.log(`[DEBUG] bringToTop() 失败: ${e.message}`)
      throw new Error('无法激活企业微信窗口')
    }

    await delay(500)

    // 验证激活结果
    const activeWin = windowManager.getActiveWindow()
    if (!activeWin || !isWeChatWindow(activeWin)) {
      console.log('[DEBUG] 窗口激活失败')
      throw new Error('企业微信窗口激活失败，请手动切换到微信窗口')
    }

    console.log('[DEBUG] 窗口已成功激活')
  }
}