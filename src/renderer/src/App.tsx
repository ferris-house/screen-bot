// src/renderer/src/App.tsx

import React, { useState } from 'react'
import Container from './components/layout/Container'
import Header from './components/layout/Header'
import Footer from './components/layout/Footer'
import TestModule from './components/TestModule/TestModule'
import QueueModule from './components/QueueModule/QueueModule'
import LogSection from './components/LogSection/LogSection'
import Toast from './components/common/Toast'

type PageType = 'queue' | 'test'

function App(): React.ReactElement {
  const [currentPage, setCurrentPage] = useState<PageType>('queue')

  return (
    <>
      <Container>
        <Header currentPage={currentPage} onPageChange={setCurrentPage} />
        <div className="main-view">
          {currentPage === 'queue' ? (
            <>
              <QueueModule />
              <LogSection />
            </>
          ) : (
            <>
              <TestModule />
              <LogSection />
            </>
          )}
        </div>
      </Container>
      <Toast />
    </>
  )
}

export default App