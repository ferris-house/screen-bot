// src/renderer/src/stores/queueStore.ts

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { QueueAgentConfig, QueueAgentStatus } from '@shared/types'
import { DEFAULT_QUEUE_CONFIG } from '@shared/types'

interface QueueState {
  config: QueueAgentConfig
  status: QueueAgentStatus
  updateConfig: (patch: Partial<QueueAgentConfig>) => void
  updateStatus: (patch: Partial<QueueAgentStatus>) => void
  startAgent: (config: QueueAgentConfig) => Promise<void>
  stopAgent: () => Promise<void>
  abortAgent: () => Promise<void>
  loadStatus: () => Promise<void>
}

export const useQueueStore = create<QueueState>()(
  persist(
    (set, get) => ({
      config: DEFAULT_QUEUE_CONFIG,
      status: {
        enabled: false,
        state: 'idle',
        lastPollAt: null,
        lastTaskId: null,
        lastError: null
      },

      updateConfig: (patch) => {
        set((state) => ({
          config: { ...state.config, ...patch }
        }))
      },

      updateStatus: (patch) => {
        set((state) => ({
          status: { ...state.status, ...patch }
        }))
      },

      startAgent: async (config) => {
        const result = await window.electron.ipc.invoke('queue-agent:start', config)
        if (result.success) {
          set({ status: result.status })
        } else {
          set((state) => ({
            status: { ...state.status, lastError: result.error }
          }))
        }
      },

      stopAgent: async () => {
        const result = await window.electron.ipc.invoke('queue-agent:stop')
        set({ status: result.status })
      },

      abortAgent: async () => {
        const result = await window.electron.ipc.invoke('queue-agent:abort')
        set({ status: result.status })
      },

      loadStatus: async () => {
        const result = await window.electron.ipc.invoke('queue-agent:get-status')
        set({ status: result.status })
      }
    }),
    {
      name: 'wechat_queue_agent_config',
      partialize: (state) => ({ config: state.config })
    }
  )
)