// src/renderer/src/components/TestModule/MessageList.tsx

import React from 'react'
import type { TestMessage } from '@shared/types'
import Button from '../common/Button'

interface MessageListProps {
  messages: TestMessage[]
  onDelete: (index: number) => void
}

const MessageList: React.FC<MessageListProps> = ({ messages, onDelete }) => {
  if (messages.length === 0) {
    return (
      <div className="test-message-list">
        <div style={{ color: '#999', textAlign: 'center', padding: '10px' }}>暂无消息内容</div>
      </div>
    )
  }

  return (
    <div className="test-message-list">
      {messages.map((msg, index) => (
        <div key={index} className="test-message-item">
          <div className="test-message-preview">
            {msg.type === 'text'
              ? msg.content.length > 50 ? msg.content.substring(0, 50) + '...' : msg.content
              : <img src={msg.content} style={{ maxWidth: '60px', maxHeight: '40px' }} />
            }
          </div>
          <div className="test-message-actions">
            <Button variant="danger" size="small" onClick={() => onDelete(index)}>删除</Button>
          </div>
        </div>
      ))}
    </div>
  )
}

export default MessageList