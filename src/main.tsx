import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Block pinch-zoom on iOS Safari (which ignores user-scalable=no)
const blockGesture = (e: Event) => e.preventDefault()
document.addEventListener('gesturestart', blockGesture, { passive: false })
document.addEventListener('gesturechange', blockGesture, { passive: false })
document.addEventListener('gestureend', blockGesture, { passive: false })

// Block multi-touch pinch-zoom (Android + cross-browser fallback)
document.addEventListener(
  'touchmove',
  (e) => {
    if (e.touches.length > 1) e.preventDefault()
  },
  { passive: false },
)

// Block double-tap-to-zoom
let lastTouchEnd = 0
document.addEventListener(
  'touchend',
  (e) => {
    const now = Date.now()
    if (now - lastTouchEnd <= 300) e.preventDefault()
    lastTouchEnd = now
  },
  { passive: false },
)

// Block desktop trackpad pinch-zoom (Ctrl+wheel)
document.addEventListener(
  'wheel',
  (e) => {
    if (e.ctrlKey) e.preventDefault()
  },
  { passive: false },
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
