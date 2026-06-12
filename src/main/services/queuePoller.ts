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
let queueAgentConfig: QueueAgentConfig = DEFAULT_QUEUE_CONFIG
let queueAgentStatus: QueueAgentStatus = {
  enabled: false,
  state: 'idle',
  lastPollAt: null,
  lastTaskId: null,
  lastError: null
}
let mainWindow: BrowserWindow | null = null

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

  const message = rawTask.message || rawTask.content
  const items = Array.isArray(rawTask.items)
    ? rawTask.items
    : [{ type: rawTask.type || 'text', content: message }]

  return {
    id: rawTask.id || rawTask.taskId || String(Date.now()),
    targets: Array.isArray(rawTask.targets) ? rawTask.targets : [],
    items: items.filter((item: any) => item && item.content),
    raw: rawTask
  }
}

async function requestQueueApi(path: string, options: Record<string, any> = {}): Promise<any> {
  const baseUrl = queueAgentConfig.queueUrl.replace(/\/+$/, '')
  const url = `${baseUrl}${path}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(queueAgentConfig.token ? { Authorization: `Bearer ${queueAgentConfig.token}` } : {}),
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
  const body = {
    agentId: queueAgentConfig.agentId || 'default-agent',
    limit: 1
  }
  const data = await requestQueueApi('/tasks/claim', {
    method: 'POST',
    body: JSON.stringify(body)
  })

  if (Array.isArray(data)) return data
  if (Array.isArray(data.tasks)) return data.tasks
  if (data.task) return [data.task]
  return []
}

async function reportRemoteTask(taskId: string, payload: TaskReport): Promise<void> {
  await requestQueueApi(`/tasks/${encodeURIComponent(taskId)}/result`, {
    method: 'POST',
    body: JSON.stringify(payload)
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
    try {
      if (target) {
        emitQueueAgentLog(`正在打开群聊：${target}`, 'info')
        await openChatByName(target)
      } else {
        await activateWeChatWindow()
      }

      for (const item of task.items) {
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
  if (!queueAgentRunning || queueAgentBusy) return

  queueAgentBusy = true
  updateQueueAgentStatus({ state: 'polling', lastPollAt: new Date().toISOString(), lastError: null })

  try {
    const tasks = await claimRemoteTasks()
    if (tasks.length === 0) {
      updateQueueAgentStatus({ state: 'idle' })
      return
    }
    for (const task of tasks) {
      await executeRemoteTask(task)
    }
    updateQueueAgentStatus({ state: 'idle' })
  } catch (error: any) {
    updateQueueAgentStatus({ state: 'error', lastError: error.message })
    emitQueueAgentLog(`远程队列轮询失败：${error.message}`, 'error')
  } finally {
    queueAgentBusy = false
  }
}

export function stopQueueAgent(): void {
  queueAgentRunning = false
  if (queueAgentTimer) {
    clearInterval(queueAgentTimer)
    queueAgentTimer = null
  }
  updateQueueAgentStatus({ enabled: false, state: 'idle' })
}

export function startQueueAgent(config: QueueAgentConfig, win: BrowserWindow): void {
  if (!config || !config.queueUrl) {
    throw new Error('请先填写队列接口 URL')
  }

  mainWindow = win
  stopQueueAgent()

  queueAgentConfig = {
    queueUrl: config.queueUrl,
    token: config.token || '',
    agentId: config.agentId || 'default-agent',
    intervalSeconds: Math.max(Number(config.intervalSeconds) || 60, 10)
  }

  queueAgentRunning = true
  updateQueueAgentStatus({ enabled: true, state: 'idle', lastError: null })
  emitQueueAgentLog(`远程队列轮询已启动，间隔 ${queueAgentConfig.intervalSeconds} 秒`, 'success')

  pollQueueAgentOnce()
  queueAgentTimer = setInterval(pollQueueAgentOnce, queueAgentConfig.intervalSeconds * 1000)
}

export function getQueueAgentStatus(): QueueAgentStatus {
  return queueAgentStatus
}