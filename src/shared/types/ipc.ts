// src/shared/types/ipc.ts

// IPC 通道定义
export type IpcChannel =
  | 'open-chat'
  | 'send-item'
  | 'queue-agent:start'
  | 'queue-agent:stop'
  | 'queue-agent:get-status'
  | 'queue-agent:status'
  | 'queue-agent:log'
  | 'shell:open-external'

// IPC API 接口
export interface IpcApi {
  invoke: <T = any>(channel: IpcChannel, data?: any) => Promise<T>
  on: (channel: IpcChannel, handler: (data: any) => void) => () => void
  send: (channel: IpcChannel, data?: any) => void
}

// IPC 调用参数和返回值类型映射
export interface IpcInvokeMap {
  'open-chat': {
    params: { target: string }
    result: { success: boolean; error?: string }
  }
  'send-item': {
    params: SendItem
    result: { success: boolean; error?: string }
  }
  'queue-agent:start': {
    params: QueueAgentConfig
    result: { success: boolean; status: QueueAgentStatus; error?: string }
  }
  'queue-agent:stop': {
    params: void
    result: { success: boolean; status: QueueAgentStatus }
  }
  'queue-agent:get-status': {
    params: void
    result: { status: QueueAgentStatus }
  }
  'shell:open-external': {
    params: string
    result: void
  }
}

// IPC 推送事件类型映射
export interface IpcOnMap {
  'queue-agent:status': QueueAgentStatus
  'queue-agent:log': { message: string; type: 'info' | 'success' | 'error' | 'warning' }
}

// 导入其他类型
import type { QueueAgentConfig, QueueAgentStatus } from './config'
import type { SendItem } from './task'