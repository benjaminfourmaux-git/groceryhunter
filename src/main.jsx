import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import RotateHint from './components/RotateHint'
import { LanguageProvider } from './lib/i18n'
import { initTheme } from './lib/theme'
import './index.css'

initTheme() // avant le rendu : pas de flash du mauvais thème

// Portrait uniquement. Le verrou n'est accepté que par certains navigateurs
// (Android, app installée) ; ailleurs, RotateHint prend le relais.
screen.orientation?.lock?.('portrait').catch(() => {})

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LanguageProvider>
      <App />
      <RotateHint />
    </LanguageProvider>
  </React.StrictMode>
)
