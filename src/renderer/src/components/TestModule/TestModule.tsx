// src/renderer/src/components/TestModule/TestModule.tsx

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useTestStore, useLogStore, useToastStore } from '../../stores'
import Button from '../common/Button'
import FormGroup from '../common/FormGroup'
import Input from '../common/Input'
import TextArea from '../common/TextArea'
import MessageList from './MessageList'

const TestModule: React.FC = () => {
  const { config, messages, pollStatus, updateConfig, addMessage, deleteMessage, startPoll, stopPoll } = useTestStore()
  const { addLog } = useLogStore()
  const { showToast } = useToastStore()

  const [messageInput, setMessageInput] = useState('')
  const [loading, setLoading] = useState(false)
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null)

  // 添加文字消息
  const handleAddText = useCallback(() => {
    if (!messageInput.trim()) {
      showToast('请输入消息内容', 2000)
      return
    }
    addMessage({ type: 'text', content: messageInput.trim() })
    setMessageInput('')
    addLog('已添加文字消息到测试配置', 'success')
    showToast('已添加文字消息', 1500)
  }, [messageInput, addMessage, addLog, showToast])

  // 执行测试
  const executeTest = useCallback(async () => {
    if (messages.length === 0) {
      showToast('请先添加消息内容', 2000)
      addLog('测试执行失败：没有消息内容', 'error')
      return
    }

    addLog('开始立即执行测试...', 'info')
    addLog(`目标群: ${config.target || '当前聊天窗口'}`, 'info')
    addLog(`消息数量: ${messages.length}`, 'info')

    setLoading(true)

    try {
      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i]
        addLog(`正在发送第 ${i + 1} 条消息...`, 'info')

        // 如果有目标群名，先搜索打开群聊
        if (config.target && i === 0) {
          const openResult = await window.electron.ipc.invoke('open-chat', { target: config.target })
          if (!openResult.success) {
            throw new Error(openResult.error)
          }
          addLog(`已打开群聊: ${config.target}`, 'success')
        }

        // 发送消息
        const result = await window.electron.ipc.invoke('send-item', msg)
        if (!result.success) {
          throw new Error(result.error)
        }
        addLog(`第 ${i + 1} 条发送成功`, 'success')

        if (i < messages.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }

      addLog('测试执行完成！', 'success')
      showToast('测试执行成功！', 2000)
    } catch (error: any) {
      addLog(`测试执行失败：${error.message}`, 'error')
      showToast(`执行失败：${error.message}`, 3000)
    }

    setLoading(false)
  }, [config, messages, addLog, showToast])

  // 开始轮询
  const handleStartPoll = useCallback(() => {
    if (messages.length === 0) {
      showToast('请先添加消息内容', 2000)
      addLog('轮询启动失败：没有消息内容', 'error')
      return
    }

    startPoll()
    addLog('测试轮询已启动，间隔 60 秒', 'success')
    showToast('测试轮询已启动', 2000)

    executeTest()
    pollTimerRef.current = setInterval(executeTest, 60000)
  }, [messages, startPoll, executeTest, addLog, showToast])

  // 停止轮询
  const handleStopPoll = useCallback(() => {
    stopPoll()
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
    addLog('测试轮询已停止', 'info')
    showToast('测试轮询已停止', 2000)
  }, [stopPoll, addLog, showToast])

  // 保存配置
  const handleSave = useCallback(() => {
    updateConfig({ target: config.target })
    addLog('测试配置已保存', 'success')
    showToast('测试配置已保存', 2000)
  }, [config, updateConfig, addLog, showToast])

  return (
    <section className="test-section">
      <div className="test-header">
        <div className="test-title">测试模块</div>
        <div className="test-info">快速测试发送功能，无需创建任务</div>
      </div>

      <FormGroup label="目标群名">
        <Input
          id="test-target-input"
          placeholder="输入要发送的群名称"
          value={config.target}
          onChange={(value) => updateConfig({ target: value })}
        />
      </FormGroup>

      <FormGroup label="消息内容">
        <TextArea
          id="test-message-input"
          placeholder="输入要发送的消息内容"
          value={messageInput}
          onChange={setMessageInput}
        />
      </FormGroup>

      <MessageList messages={messages} onDelete={deleteMessage} />

      <div className="test-actions-inline">
        <Button variant="primary" size="small" onClick={handleAddText}>添加文字</Button>
        <Button variant="primary" size="small" onClick={() => showToast('图片功能待实现', 2000)}>添加图片</Button>
      </div>

      <div className="test-actions">
        <Button variant="success" onClick={handleSave}>保存配置</Button>
        <Button variant="gradient" loading={loading} onClick={executeTest}>立即执行</Button>
        <Button variant="primary" disabled={pollStatus.active} onClick={handleStartPoll}>轮询执行</Button>
        <Button variant="warning" disabled={!pollStatus.active} onClick={handleStopPoll}>停止轮询</Button>
      </div>

      <div className="test-status">
        <span>状态：{pollStatus.active ? '轮询中' : '未启动'}</span>
      </div>
    </section>
  )
}

export default TestModule