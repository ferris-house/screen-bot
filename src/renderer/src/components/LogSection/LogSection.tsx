// src/renderer/src/components/LogSection/LogSection.tsx

import React, { useEffect, useRef } from 'react'
import { useLogStore } from '../../stores'
import Button from '../common/Button'

const LogSection: React.FC = () => {
  const { entries, clearLogs } = useLogStore()
  const logContentRef = useRef<HTMLDivElement>(null)

  // 自动滚动到最新日志
  useEffect(() => {
    if (logContentRef.current) {
      logContentRef.current.scrollTop = logContentRef.current.scrollHeight
    }
  }, [entries])

  return (
    <section className="log-section">
      <div className="log-header">
        <div className="log-title">执行日志</div>
        <Button variant="warning" onClick={clearLogs}>清空</Button>
      </div>
      <div className="log-content" ref={logContentRef}>
        {entries.length === 0 ? (
          <div style={{ color: '#999', textAlign: 'center' }}>暂无日志</div>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className={`log-entry log-${entry.type}`}>
              [{entry.timestamp}] {entry.message}
            </div>
          ))
        )}
      </div>
    </section>
  )
}

export default LogSection