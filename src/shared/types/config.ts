// src/shared/types/config.ts

// 队列代理配置
export interface QueueAgentConfig {
  queueUrl: string       // 拉取消息接口完整 URL
  intervalSeconds: number
  // 上报配置
  reportEnabled: boolean  // 是否启用上报，true=上报，false=不上报
  reportUrl: string      // 上报接口完整 URL
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
  intervalSeconds: 60,
  reportEnabled: true,
  reportUrl: ''
}

export const DEFAULT_TEST_CONFIG: TestConfig = {
  target: ''
}