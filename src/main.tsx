import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './tokens.css'
import App from './App'

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)

// The logo finishes drawing before the app appears, however fast the page loaded.
const splash = document.getElementById('splash')
if (splash) {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches
  setTimeout(() => {
    splash.classList.add('out')
    setTimeout(() => splash.remove(), 300)
  }, still ? 200 : Math.max(0, 1300 - performance.now()))
}
