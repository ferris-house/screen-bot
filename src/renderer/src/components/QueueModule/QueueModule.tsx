// src/renderer/src/components/QueueModule/QueueModule.tsx

import React, { useEffect, useCallback } from 'react'
import { useQueueStore, useLogStore, useToastStore } from '../../stores'
import Button from '../common/Button'
import FormGroup from '../common/FormGroup'
import Input from '../common/Input'

const QueueModule: React.FC = () => {
  const {
    config,
    status,
    updateConfig,
    startAgent,
    stopAgent,
    loadStatus,
    updateStatus
  } = useQueueStore()
  const { addLog } = useLogStore()
  const { showToast } = useToastStore()

  // 初始化加载状态并监听 IPC 事件
  useEffect(() => {
    loadStatus()

    // 监听状态更新
    const unsubStatus = window.electron.ipc.on('queue-agent:status', (newStatus) => {
      updateStatus(newStatus)
    })

    // 监听日志
    const unsubLog = window.electron.ipc.on('queue-agent:log', (payload) => {
      addLog(payload.message, payload.type || 'info')
    })

    return () => {
      unsubStatus()
      unsubLog()
    }
  }, [loadStatus, updateStatus, addLog])

  // 保存配置
  const handleSave = useCallback(() => {
    updateConfig(config)
    addLog('远程队列配置已保存', 'success')
    showToast('远程队列配置已保存', 2000)
  }, [config, updateConfig, addLog, showToast])

  // 启动轮询
  const handleStart = useCallback(async () => {
    if (!config.queueUrl) {
      showToast('请先填写队列接口 URL', 2000)
      addLog('请先填写队列接口 URL', 'warning')
      return
    }

    await startAgent(config)
    addLog('远程队列轮询已启动', 'success')
    showToast('远程队列轮询已启动', 2000)
  }, [config, startAgent, addLog, showToast])

  // 停止轮询
  const handleStop = useCallback(async () => {
    await stopAgent()
    addLog('远程队列轮询已停止', 'info')
    showToast('远程队列轮询已停止', 2000)
  }, [stopAgent, addLog, showToast])

  // 格式化时间
  const formatTime = (value: string | null) => {
    if (!value) return '-'
    try {
      return new Date(value).toLocaleString()
    } catch {
      return value
    }
  }

  return (
    <section className="queue-section">
      <div className="queue-header">
        <div className="queue-title">远程队列</div>
        <div className="queue-status">
          {status.enabled ? `运行中：${status.state}` : '未启动'}
        </div>
      </div>

      <div className="queue-form">
        <FormGroup label="队列接口 URL">
          <Input
            id="queue-url-input"
            placeholder="https://example.com/api"
            value={config.queueUrl}
            onChange={(value) => updateConfig({ queueUrl: value })}
          />
        </FormGroup>

        <FormGroup label="Token">
          <Input
            id="queue-token-input"
            type="password"
            placeholder="Bearer Token"
            value={config.token}
            onChange={(value) => updateConfig({ token: value })}
          />
        </FormGroup>

        <FormGroup label="Agent ID">
          <Input
            id="queue-agent-id-input"
            placeholder="default-agent"
            value={config.agentId}
            onChange={(value) => updateConfig({ agentId: value })}
          />
        </FormGroup>

        <FormGroup label="间隔秒数">
          <Input
            id="queue-interval-input"
            type="number"
            min={10}
            value={config.intervalSeconds}
            onChange={(value) => updateConfig({ intervalSeconds: Number(value) })}
          />
        </FormGroup>
      </div>

      <div className="queue-actions">
        <Button variant="primary" onClick={handleSave}>保存配置</Button>
        <Button variant="success" disabled={status.enabled} onClick={handleStart}>启动轮询</Button>
        <Button variant="warning" disabled={!status.enabled} onClick={handleStop}>停止轮询</Button>
      </div>

      <div className="queue-meta">
        <div className="queue-meta-item">最近轮询：{formatTime(status.lastPollAt)}</div>
        <div className="queue-meta-item">最近任务：{status.lastTaskId || '-'}</div>
        <div className="queue-meta-item">最近错误：{status.lastError || '-'}</div>
      </div>
    </section>
  )
}

export default QueueModule