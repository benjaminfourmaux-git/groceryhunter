import React from 'react'
import { createRoot } from 'react-dom/client'
import App from '../src/App.jsx'
import { LanguageProvider } from '../src/lib/i18n'
import '../src/index.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </React.StrictMode>
)

// Un bandeau qui dit ce que c'est, puis s'efface : il ne faut pas croire que
// les données sont réelles, ni s'étonner qu'un article file en 8 secondes.
const bandeau = document.createElement('div')
bandeau.textContent = 'Démonstration · données locales · 8 s au lieu d’1 h'
Object.assign(bandeau.style, {
  position: 'fixed',
  left: '50%',
  top: 'calc(env(safe-area-inset-top, 0px) + 8px)',
  transform: 'translateX(-50%)',
  zIndex: '999',
  maxWidth: 'calc(100% - 24px)',
  padding: '7px 14px',
  borderRadius: '999px',
  background: 'rgba(20, 28, 16, 0.82)',
  color: '#fff',
  font: '600 12px/1.3 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  textAlign: 'center',
  pointerEvents: 'none',
  transition: 'opacity 0.6s ease',
})
document.body.appendChild(bandeau)
setTimeout(() => {
  bandeau.style.opacity = '0'
}, 6000)
setTimeout(() => bandeau.remove(), 7000)
