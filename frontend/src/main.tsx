import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

// Register service worker for PWA (handled by vite-plugin-pwa in production)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('SW registered:', registration.scope)
      })
      .catch((err) => {
        console.warn('SW registration failed:', err)
      })
  })
}

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element #root not found in DOM')
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
