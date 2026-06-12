// src/renderer/src/components/common/Input.tsx

import React from 'react'

interface InputProps {
  id: string
  type?: 'text' | 'password' | 'number'
  placeholder?: string
  value?: string | number
  min?: number
  onChange?: (value: string) => void
}

const Input: React.FC<InputProps> = ({
  id,
  type = 'text',
  placeholder,
  value,
  min,
  onChange
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      onChange(e.target.value)
    }
  }

  return (
    <input
      id={id}
      type={type}
      className="form-input"
      placeholder={placeholder}
      value={value}
      min={min}
      onChange={handleChange}
    />
  )
}

export default Input