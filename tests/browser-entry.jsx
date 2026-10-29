import './browser-env'
import React from 'react'
import { createRoot } from 'react-dom/client'
import Sandbox from './browser'
import { LanguageProvider } from '../src/lib/i18n'
import { initTheme } from '../src/lib/theme'

initTheme()
createRoot(document.getElementById('root')).render(<React.StrictMode><LanguageProvider><Sandbox /></LanguageProvider></React.StrictMode>)
