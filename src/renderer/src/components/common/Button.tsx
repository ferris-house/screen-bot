// src/renderer/src/components/common/Button.tsx

import React from 'react'

type ButtonVariant = 'primary' | 'success' | 'danger' | 'warning' | 'gradient'
type ButtonSize = 'default' | 'small'

interface ButtonProps {
  variant: ButtonVariant
  size?: ButtonSize
  disabled?: boolean
  loading?: boolean
  onClick?: () => void
  children: React.ReactNode
}

const Button: React.FC<ButtonProps> = ({
  variant,
  size = 'default',
  disabled = false,
  loading = false,
  onClick,
  children
}) => {
  const className = `btn btn-${variant}${size === 'small' ? ' btn-small' : ''}`

  return (
    <button
      className={className}
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading ? '执行中...' : children}
    </button>
  )
}

export default Button