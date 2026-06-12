// src/renderer/src/App.tsx

import React from 'react'
import Container from './components/layout/Container'
import Header from './components/layout/Header'
import Footer from './components/layout/Footer'
import TestModule from './components/TestModule/TestModule'
import QueueModule from './components/QueueModule/QueueModule'
import LogSection from './components/LogSection/LogSection'
import Toast from './components/common/Toast'

function App(): React.ReactElement {
  return (
    <>
      <Container>
        <Header />
        <div className="main-view">
          <TestModule />
          <QueueModule />
          <LogSection />
        </div>
        <Footer />
      </Container>
      <Toast />
    </>
  )
}

export default App