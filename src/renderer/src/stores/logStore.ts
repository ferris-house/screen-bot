// src/renderer/src/stores/logStore.ts

import { create } from 'zustand'
import type { LogEntry } from '@shared/types'

interface LogState {
  entries: LogEntry[]
  addLog: (message: string, type: 'info' | 'success' | 'error' | 'warning') => void
  clearLogs: () => void
}

export const useLogStore = create<LogState>((set) => ({
  entries: [],

  addLog: (message, type) => {
    const entry: LogEntry = {
      id: Date.now(),
      timestamp: new Date().toLocaleTimeString(),
      message,
      type
    }
    set((state) => ({
      entries: [...state.entries, entry]
    }))
  },

  clearLogs: () => set({ entries: [] })
}))