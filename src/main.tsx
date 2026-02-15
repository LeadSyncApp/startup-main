import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import App from './App'
import ToastContainer from './components/ui/ToastContainer'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        {/* Global toast notifications - for success/error/info messages throughout the app */}
        <ToastContainer />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)

