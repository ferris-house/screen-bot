// src/renderer/src/stores/toastStore.ts

import { create } from 'zustand'

interface ToastState {
  visible: boolean
  message: string
  showToast: (message: string, duration?: number) => void
  hideToast: () => void
}

export const useToastStore = create<ToastState>((set) => ({
  visible: false,
  message: '',

  showToast: (message, duration = 3000) => {
    set({ visible: true, message })
    setTimeout(() => {
      set({ visible: false })
    }, duration)
  },

  hideToast: () => set({ visible: false })
}))