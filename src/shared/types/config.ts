// src/shared/types/config.ts

// 队列代理配置
export interface QueueAgentConfig {
  queueUrl: string
  token: string
  agentId: string
  intervalSeconds: number
}

// 队列代理状态
export interface QueueAgentStatus {
  enabled: boolean
  state: 'idle' | 'polling' | 'sending' | 'reporting' | 'error'
  lastPollAt: string | null
  lastTaskId: string | null
  lastError: string | null
}

// 测试配置
export interface TestConfig {
  target: string
}

// 默认配置
export const DEFAULT_QUEUE_CONFIG: QueueAgentConfig = {
  queueUrl: '',
  token: '',
  agentId: 'default-agent',
  intervalSeconds: 60
}

export const DEFAULT_TEST_CONFIG: TestConfig = {
  target: ''
}