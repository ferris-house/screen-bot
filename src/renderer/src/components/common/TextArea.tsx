// src/renderer/src/components/common/TextArea.tsx

import React from 'react'

interface TextAreaProps {
  id: string
  placeholder?: string
  value?: string
  onChange?: (value: string) => void
}

const TextArea: React.FC<TextAreaProps> = ({
  id,
  placeholder,
  value,
  onChange
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (onChange) {
      onChange(e.target.value)
    }
  }

  return (
    <textarea
      id={id}
      className="form-textarea"
      placeholder={placeholder}
      value={value}
      onChange={handleChange}
    />
  )
}

export default TextArea