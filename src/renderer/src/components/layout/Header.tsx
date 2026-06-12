// src/renderer/src/components/layout/Header.tsx

import React from 'react'

const Header: React.FC = () => {
  return (
    <div className="header">
      <h1>
        <img src="shiflow_logo.png" alt="识流Logo" className="header-logo" />
        识流运营助手lite
      </h1>
    </div>
  )
}

export default Header