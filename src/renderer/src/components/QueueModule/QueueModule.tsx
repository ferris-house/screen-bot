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
    abortAgent,
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

  // 终止任务
  const handleAbort = useCallback(async () => {
    await abortAgent()
    addLog('正在终止任务...', 'warning')
    showToast('正在终止任务...', 2000)
  }, [abortAgent, addLog, showToast])

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
        <FormGroup label="拉取接口 URL">
          <Input
            id="queue-url-input"
            placeholder="https://example.com/api/messages/pending"
            value={config.queueUrl}
            onChange={(value) => updateConfig({ queueUrl: value })}
          />
        </FormGroup>

        <FormGroup label="间隔分钟数">
          <Input
            id="queue-interval-input"
            type="number"
            min={1}
            value={Math.round(config.intervalSeconds / 60)}
            onChange={(value) => updateConfig({ intervalSeconds: Number(value) * 60 })}
          />
        </FormGroup>

        <FormGroup label="启用上报">
          <div className="checkbox-wrapper">
            <input
              type="checkbox"
              id="report-enabled-checkbox"
              checked={config.reportEnabled ?? true}
              onChange={(e) => updateConfig({ reportEnabled: e.target.checked })}
            />
            <span className="checkbox-label">
              {config.reportEnabled ? '任务完成后上报结果' : '不上报任务结果'}
            </span>
          </div>
        </FormGroup>

        {config.reportEnabled && (
          <FormGroup label="上报接口 URL">
            <Input
              id="report-url-input"
              placeholder="https://example.com/api/messages/sent"
              value={config.reportUrl || ''}
              onChange={(value) => updateConfig({ reportUrl: value })}
            />
          </FormGroup>
        )}
      </div>

      <div className="queue-actions">
        <Button variant="primary" onClick={handleSave}>保存配置</Button>
        <Button variant="success" disabled={status.enabled} onClick={handleStart}>启动轮询</Button>
        <Button variant="warning" disabled={!status.enabled} onClick={handleStop}>停止轮询</Button>
        <Button variant="danger" disabled={!status.enabled} onClick={handleAbort}>终止任务</Button>
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