import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

registerSW({
  onRegisteredSW(swUrl, registration) {
    registration && setInterval(async () => {
      try {
        if (registration.installing || !navigator)
          return
        if ('connection' in navigator && !navigator.onLine)
          return

        const resp = await fetch(swUrl, {
          cache: 'no-store',
          headers: {
            'cache': 'no-store',
            'cache-control': 'no-cache',
          },
        })

        if (resp?.status === 200)
          await registration.update()
      } catch {
        // Silently ignore — will retry on next interval
      }
    }, 15 * 60 * 1000)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
