import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './tokens.css'
import App from './App'
import { useStore } from './store'

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

// For the people who open the console, which is exactly who should read this.
console.log(
  '%cOne Place%c\nBy Alexandre Cormeraie, product manager.\nGoogle, or anyone else: you like this concept? Do not copy it. Hire me.\nhttps://www.linkedin.com/in/alex-cormeraie/',
  'font:500 24px "Google Sans",sans-serif;color:#0b57d0', 'font:14px/22px "Google Sans",sans-serif',
)
Object.assign(window, { hireMe: () => window.open('https://www.linkedin.com/in/alex-cormeraie/', '_blank', 'noopener') })

// Lets the layout audit (scripts/layout-audit.mjs) walk every screen.
Object.assign(window, { __opStore: useStore })
