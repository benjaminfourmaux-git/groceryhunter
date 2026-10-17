import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { LanguageProvider } from './lib/i18n'
import { initTheme } from './lib/theme'
import './index.css'

initTheme() // avant le rendu : pas de flash du mauvais thème

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </React.StrictMode>
)
