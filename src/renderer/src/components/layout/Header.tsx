// src/renderer/src/components/layout/Header.tsx

import React from 'react'

interface HeaderProps {
  currentPage: 'queue' | 'test'
  onPageChange: (page: 'queue' | 'test') => void
}

const Header: React.FC<HeaderProps> = ({ currentPage, onPageChange }) => {
  return (
    <div className="header">
      <h1>
        企微群发助手
      </h1>
      {currentPage === 'queue' ? (
        <button className="header-action-btn test-btn" onClick={() => onPageChange('test')}>
          <span className="btn-icon">🧪</span>
          测试
        </button>
      ) : (
        <button className="header-action-btn back-btn" onClick={() => onPageChange('queue')}>
          <span className="btn-icon">←</span>
          返回
        </button>
      )}
    </div>
  )
}

export default Header
