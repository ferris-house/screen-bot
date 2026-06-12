// src/renderer/src/stores/testStore.ts

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { TestMessage, TestConfig, TestPollStatus } from '@shared/types'
import { DEFAULT_TEST_CONFIG } from '@shared/types'

interface TestState {
  config: TestConfig
  messages: TestMessage[]
  pollStatus: TestPollStatus

  updateConfig: (patch: Partial<TestConfig>) => void
  addMessage: (message: TestMessage) => void
  deleteMessage: (index: number) => void
  startPoll: () => void
  stopPoll: () => void
}

export const useTestStore = create<TestState>()(
  persist(
    (set) => ({
      config: DEFAULT_TEST_CONFIG,
      messages: [],
      pollStatus: { active: false },

      updateConfig: (patch) => {
        set((state) => ({
          config: { ...state.config, ...patch }
        }))
      },

      addMessage: (message) => {
        set((state) => ({
          messages: [...state.messages, message]
        }))
      },

      deleteMessage: (index) => {
        set((state) => ({
          messages: state.messages.filter((_, i) => i !== index)
        }))
      },

      startPoll: () => set({ pollStatus: { active: true } }),
      stopPoll: () => set({ pollStatus: { active: false } })
    }),
    {
      name: 'wechat_test_config'
    }
  )
)