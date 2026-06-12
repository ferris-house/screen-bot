// src/shared/types/task.ts

// 发送项类型
export interface SendItem {
  type: 'text' | 'image'
  content: string
}

// 测试消息
export interface TestMessage extends SendItem {
  id?: number
}

// 远程任务
export interface RemoteTask {
  id: string
  targets: string[]
  items: SendItem[]
  raw?: any
}

// 任务执行结果
export interface TaskResult {
  target: string
  status: 'sent' | 'failed'
  error?: string
}

// 任务报告
export interface TaskReport {
  taskId: string
  status: 'success' | 'failed' | 'partial_success'
  results: TaskResult[]
  startedAt: string
  finishedAt: string
}

// 日志条目
export interface LogEntry {
  id: number
  timestamp: string
  message: string
  type: 'info' | 'success' | 'error' | 'warning'
}