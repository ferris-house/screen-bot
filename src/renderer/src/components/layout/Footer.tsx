// src/renderer/src/components/layout/Footer.tsx

import React from 'react'

const Footer: React.FC = () => {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    window.electron.shell.openExternal('https://thiflow.com')
  }

  return (
    <div className="footer-link">
      <a href="#" onClick={handleClick}>thiflow.com</a>
    </div>
  )
}

export default Footer