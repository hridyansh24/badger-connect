import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { FeedbackProvider } from './context/FeedbackContext.tsx'
import { SocketProvider } from './context/SocketContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <SocketProvider>
        <FeedbackProvider>
          <App />
        </FeedbackProvider>
      </SocketProvider>
    </BrowserRouter>
  </StrictMode>,
)
