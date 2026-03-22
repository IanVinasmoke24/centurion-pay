import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

// Force service worker to check for updates immediately
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(r => r.update())
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
