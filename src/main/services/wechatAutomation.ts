// src/main/services/wechatAutomation.ts

import robot from 'robotjs'
import { clipboard, nativeImage } from 'electron'
import { delay } from '../utils/delay'
import { getShortcut } from '../utils/shortcuts'
import { dataURLToPNGBuffer } from '../utils/dataURL'
import { activateWeChatWindow } from './wechatWindow'
import type { SendItem } from '@shared/types'

export async function pasteText(text: string): Promise<void> {
  clipboard.writeText(text)
  console.log(`[DEBUG] 已写入剪贴板: "${text}"`)
  await delay(150)

  const shortcut = getShortcut('paste')
  console.log(`[DEBUG] 发送粘贴快捷键: ${shortcut.modifier}+${shortcut.key}`)
  robot.keyTap(shortcut.key, shortcut.modifier)
  await delay(200)
}

export async function openChatByName(target: string): Promise<void> {
  console.log(`[DEBUG] 开始搜索群聊: "${target}"`)
  await activateWeChatWindow()
  console.log('[DEBUG] 窗口已激活')

  const searchShortcut = getShortcut('search')
  console.log(`[DEBUG] 发送搜索快捷键: ${searchShortcut.modifier}+${searchShortcut.key}`)
  robot.keyTap(searchShortcut.key, searchShortcut.modifier)
  await delay(800)

  console.log('[DEBUG] 开始粘贴搜索内容')
  await pasteText(target)
  await delay(1200)

  console.log('[DEBUG] 发送 Enter 选择搜索结果')
  robot.keyTap('enter')
  await delay(1000)

  robot.keyTap('enter')
  await delay(500)
  console.log('[DEBUG] 搜索完成')
}

export async function pasteItemToWeChat(item: SendItem): Promise<void> {
  console.log(`[DEBUG] pasteItemToWeChat 开始, 类型: ${item.type}`)

  if (item.type === 'text') {
    clipboard.writeText(item.content)
    console.log(`[DEBUG] 已写入文本到剪贴板: "${item.content.substring(0, 50)}..."`)
  } else if (item.type === 'image') {
    const buf = dataURLToPNGBuffer(item.content)
    const img = nativeImage.createFromBuffer(buf)
    clipboard.writeImage(img)
    console.log('[DEBUG] 已写入图片到剪贴板')
  } else {
    throw new Error(`暂不支持的内容类型: ${item.type}`)
  }

  await delay(200)
  const shortcut = getShortcut('paste')
  console.log(`[DEBUG] 发送粘贴快捷键: ${shortcut.modifier}+${shortcut.key}`)
  robot.keyTap(shortcut.key, shortcut.modifier)
  await delay(300)
  console.log('[DEBUG] pasteItemToWeChat 完成')
}

async function confirmSendInWeChat(): Promise<void> {
  console.log('[DEBUG] 发送 Enter 确认发送')
  robot.keyTap('enter')
  await delay(process.platform === 'win32' ? 600 : 500)
}

export async function sendToWeChat(item: SendItem): Promise<void> {
  console.log('[DEBUG] sendToWeChat 开始')

  if (!item || !item.content) {
    throw new Error('发送内容为空')
  }

  const normalizedItem: SendItem = {
    type: item.type || 'text',
    content: item.content
  }

  await activateWeChatWindow()
  console.log('[DEBUG] 窗口激活完成，开始粘贴')
  await pasteItemToWeChat(normalizedItem)

  await delay(process.platform === 'win32' ? 500 : 300)
  console.log('[DEBUG] 等待完成，开始确认发送')
  await confirmSendInWeChat()
  console.log('[DEBUG] sendToWeChat 完成')
}