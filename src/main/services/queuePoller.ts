// src/main/services/queuePoller.ts

import { BrowserWindow } from 'electron'
import { delay } from '../utils/delay'
import { activateWeChatWindow } from './wechatWindow'
import { openChatByName } from './wechatAutomation'
import { sendToWeChat } from './wechatAutomation'
import type { QueueAgentConfig, QueueAgentStatus, RemoteTask, TaskReport, TaskResult, SendItem } from '@shared/types'
import { DEFAULT_QUEUE_CONFIG } from '@shared/types'

let queueAgentTimer: NodeJS.Timeout | null = null
let queueAgentRunning = false
let queueAgentBusy = false
let shouldAbortTask = false
let pendingPoll = false // 标记：是否有等待中的轮询动作
let queueAgentConfig: QueueAgentConfig = DEFAULT_QUEUE_CONFIG
let queueAgentStatus: QueueAgentStatus = {
  enabled: false,
  state: 'idle',
  lastPollAt: null,
  lastTaskId: null,
  lastError: null
}
let mainWindow: BrowserWindow | null = null

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`
  }

  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    const m = minutes % 60
    const s = seconds % 60
    return `${hours}小时${m}分${s}秒`
  } else if (minutes > 0) {
    const s = seconds % 60
    return `${minutes}分${s}秒`
  } else {
    return `${seconds}秒`
  }
}

function emitQueueAgentStatus(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('queue-agent:status', queueAgentStatus)
  }
}

function emitQueueAgentLog(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info'): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('queue-agent:log', { message, type })
  }
}

function updateQueueAgentStatus(patch: Partial<QueueAgentStatus>): void {
  queueAgentStatus = { ...queueAgentStatus, ...patch }
  emitQueueAgentStatus()
}

function normalizeRemoteTask(rawTask: any): RemoteTask {
  if (!rawTask || typeof rawTask !== 'object') {
    throw new Error('任务格式无效')
  }

  // 新接口格式：{ id, chatName, content }
  // chatName 为目标群聊，content 为消息内容
  const message = rawTask.content || rawTask.message
  const target = rawTask.chatName || rawTask.target

  const items = Array.isArray(rawTask.items)
    ? rawTask.items
    : [{ type: 'text', content: message }]

  return {
    id: rawTask.id || String(Date.now()),
    targets: target ? [target] : [],
    items: items.filter((item: any) => item && item.content),
    raw: rawTask
  }
}

async function requestApi(url: string, options: Record<string, any> = {}): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  }

  const response = await fetch(url, { ...options, headers })
  const text = await response.text()
  let data = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch (error) {
      throw new Error(`接口返回不是有效 JSON: ${text.slice(0, 120)}`)
    }
  }

  if (!response.ok) {
    throw new Error(data && data.error ? data.error : `接口请求失败: ${response.status}`)
  }

  return data
}

async function claimRemoteTasks(): Promise<any[]> {
  const url = queueAgentConfig.queueUrl
  const data = await requestApi(url, {
    method: 'GET'
  })
  // 处理新接口格式：{ status: 0, result: [...] }
  if (data && data.status === 0) {
    return Array.isArray(data.result) ? data.result : []
  }

  // 兼容旧格式
  if (Array.isArray(data)) return data
  if (Array.isArray(data.tasks)) return data.tasks
  if (data.task) return [data.task]
  return []
}

async function reportRemoteTask(taskId: string, payload: TaskReport): Promise<void> {
  // 检查是否启用上报
  if (!queueAgentConfig.reportEnabled) {
    emitQueueAgentLog(`上报已禁用，跳过上报任务 ${taskId}`, 'info')
    return
  }

  // 检查是否配置了上报 URL
  if (!queueAgentConfig.reportUrl) {
    emitQueueAgentLog(`未配置上报接口 URL，跳过上报任务 ${taskId}`, 'warning')
    return
  }

  // pushStatus: 1=成功，-1=失败
  const pushStatus = payload.status === 'success' ? 1 : -1

  await requestApi(queueAgentConfig.reportUrl, {
    method: 'POST',
    body: JSON.stringify({
      queueId: taskId,
      pushStatus
    })
  })
}

async function executeRemoteTask(rawTask: any): Promise<void> {
  const task = normalizeRemoteTask(rawTask)
  const startedAt = new Date().toISOString()
  const results: TaskResult[] = []

  if (task.items.length === 0) {
    throw new Error('任务没有可发送内容')
  }

  updateQueueAgentStatus({ state: 'sending', lastTaskId: task.id, lastError: null })
  emitQueueAgentLog(`开始执行远程任务 ${task.id}`, 'info')

  const targets = task.targets.length > 0 ? task.targets : [null]
  for (const target of targets) {
    if (shouldAbortTask) {
      emitQueueAgentLog('任务已被终止', 'warning')
      throw new Error('任务已被用户终止')
    }

    try {
      if (target) {
        emitQueueAgentLog(`正在打开群聊：${target}`, 'info')
        await openChatByName(target)
      } else {
        await activateWeChatWindow()
      }

      for (const item of task.items) {
        if (shouldAbortTask) {
          emitQueueAgentLog('任务已被终止', 'warning')
          throw new Error('任务已被用户终止')
        }

        if (item.type && item.type !== 'text' && item.type !== 'image') {
          throw new Error(`暂不支持的内容类型: ${item.type}`)
        }
        await sendToWeChat(item as SendItem)
        await delay(500)
      }

      results.push({ target: target || 'current_chat', status: 'sent' })
      emitQueueAgentLog(`${target || '当前会话'} 发送成功`, 'success')
    } catch (error: any) {
      results.push({
        target: target || 'current_chat',
        status: 'failed',
        error: error.message
      })
      emitQueueAgentLog(`${target || '当前会话'} 发送失败：${error.message}`, 'error')

      if (shouldAbortTask) {
        throw error
      }
    }
  }

  const failedCount = results.filter(item => item.status === 'failed').length
  const status = failedCount === 0 ? 'success' : failedCount === results.length ? 'failed' : 'partial_success'
  const payload: TaskReport = {
    taskId: task.id,
    status,
    results,
    startedAt,
    finishedAt: new Date().toISOString()
  }

  updateQueueAgentStatus({ state: 'reporting' })
  await reportRemoteTask(task.id, payload)
  emitQueueAgentLog(`远程任务 ${task.id} 已回传结果：${status}`, status === 'success' ? 'success' : 'warning')
}

async function pollQueueAgentOnce(): Promise<void> {
  if (!queueAgentRunning) return

  // 如果当前有任务在执行
  if (queueAgentBusy) {
    // 暂停轮询 timer
    if (queueAgentTimer) {
      clearInterval(queueAgentTimer)
      queueAgentTimer = null
    }
    pendingPoll = true // 标记需要再拉取一次
    emitQueueAgentLog('当前任务执行中，暂停轮询，待完成后立即拉取', 'warning')
    return
  }

  queueAgentBusy = true
  updateQueueAgentStatus({ state: 'polling', lastPollAt: new Date().toISOString(), lastError: null })

  const pollStartTime = Date.now()
  try {
    const tasks = await claimRemoteTasks()

    // 拉取完成后，如果有等待的轮询标记，立即恢复 timer
    if (pendingPoll) {
      pendingPoll = false
      queueAgentTimer = setInterval(pollQueueAgentOnce, queueAgentConfig.intervalSeconds * 1000)
      emitQueueAgentLog('拉取完成，轮询已恢复', 'success')
    }

    if (tasks.length === 0) {
      updateQueueAgentStatus({ state: 'idle' })
      return
    }

    emitQueueAgentLog(`本轮拉取到 ${tasks.length} 条待发送消息`, 'info')

    for (const task of tasks) {
      await executeRemoteTask(task)
    }

    const pollDuration = Date.now() - pollStartTime
    emitQueueAgentLog(`本轮任务完成，共 ${tasks.length} 条消息，总耗时 ${formatDuration(pollDuration)}`, 'success')
    updateQueueAgentStatus({ state: 'idle' })
  } catch (error: any) {
    const pollDuration = Date.now() - pollStartTime
    updateQueueAgentStatus({ state: 'error', lastError: error.message })
    emitQueueAgentLog(`远程队列轮询失败：${error.message}，耗时 ${formatDuration(pollDuration)}`, 'error')

    // 失败时也要恢复轮询（如果有等待标记）
    if (pendingPoll) {
      pendingPoll = false
      queueAgentTimer = setInterval(pollQueueAgentOnce, queueAgentConfig.intervalSeconds * 1000)
      emitQueueAgentLog('轮询已恢复', 'success')
    }
  } finally {
    queueAgentBusy = false

    // 任务完成后，如果有等待的轮询标记，立即触发一次拉取
    if (pendingPoll && queueAgentRunning) {
      pollQueueAgentOnce()
    }
  }
}

export function stopQueueAgent(): void {
  queueAgentRunning = false
  pendingPoll = false // 清除等待标记
  if (queueAgentTimer) {
    clearInterval(queueAgentTimer)
    queueAgentTimer = null
  }
  updateQueueAgentStatus({ enabled: false, state: 'idle' })
}

export function abortQueueAgent(): void {
  shouldAbortTask = true
  pendingPoll = false // 清除等待标记
  queueAgentRunning = false
  if (queueAgentTimer) {
    clearInterval(queueAgentTimer)
    queueAgentTimer = null
  }
  emitQueueAgentLog('正在终止任务...', 'warning')

  // 等待任务终止后重置状态
  setTimeout(() => {
    updateQueueAgentStatus({ enabled: false, state: 'idle', lastError: '任务已被用户终止' })
    emitQueueAgentLog('任务已终止', 'warning')
  }, 1000)
}

export function startQueueAgent(config: QueueAgentConfig, win: BrowserWindow): void {
  if (!config || !config.queueUrl) {
    throw new Error('请先填写队列接口 URL')
  }

  mainWindow = win
  stopQueueAgent()
  shouldAbortTask = false
  pendingPoll = false // 重置等待标记
  queueAgentBusy = false

  queueAgentConfig = {
    queueUrl: config.queueUrl,
    intervalSeconds: Math.max(Number(config.intervalSeconds) || 60, 60),
    reportEnabled: config.reportEnabled ?? true,
    reportUrl: config.reportUrl || ''
  }

  queueAgentRunning = true
  updateQueueAgentStatus({ enabled: true, state: 'idle', lastError: null })
  emitQueueAgentLog(`远程队列轮询已启动，间隔 ${Math.round(queueAgentConfig.intervalSeconds / 60)} 分钟`, 'success')

  pollQueueAgentOnce()
  queueAgentTimer = setInterval(pollQueueAgentOnce, queueAgentConfig.intervalSeconds * 1000)
}

export function getQueueAgentStatus(): QueueAgentStatus {
  return queueAgentStatus
}