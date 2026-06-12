// src/shared/types/status.ts

// 轮询状态
export type PollState = 'idle' | 'polling' | 'sending' | 'reporting' | 'error'

// 测试轮询状态
export interface TestPollStatus {
  active: boolean
}

// 导出所有类型
export * from './ipc'
export * from './config'
export * from './task'