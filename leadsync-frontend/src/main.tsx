import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { SocketProvider } from './context/SocketContext'
import App from './App'
import ToastContainer from './components/ui/ToastContainer'
import ErrorBoundary from './components/ErrorBoundary'

// Debug: Add a temporary visible element immediately
const debugDiv = document.createElement('div')
debugDiv.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; z-index: 99999; background: #0F1115; color: #F8FAFC; padding: 10px; font-family: sans-serif; font-size: 14px;'
debugDiv.innerHTML = '⏳ Loading LeadSync...'
document.body.appendChild(debugDiv)

import './index.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  debugDiv.innerHTML = '❌ Error: Root element not found'
  debugDiv.style.background = '#EF4444'
  console.error('Root element not found')
  throw new Error('Root element not found')
}

// Clear debug message when app loads successfully
try {
  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <BrowserRouter>
          <AuthProvider>
            <SocketProvider>
              <App />
              <ToastContainer />
            </SocketProvider>
          </AuthProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </StrictMode>,
  )
  // Remove debug div after successful render
  setTimeout(() => {
    debugDiv.style.display = 'none'
  }, 500)
} catch (error) {
  debugDiv.innerHTML = `❌ Render Error: ${error}`
  debugDiv.style.background = '#EF4444'
  console.error('Failed to render app:', error)
}

