// src/renderer/src/components/common/Toast.tsx

import React from 'react'
import { useToastStore } from '../../stores/toastStore'

const Toast: React.FC = () => {
  const { visible, message } = useToastStore()

  if (!visible) return null

  return (
    <div className="toast-container">
      <div className="toast-message">{message}</div>
    </div>
  )
}

export default Toast