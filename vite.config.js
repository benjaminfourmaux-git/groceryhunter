import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// The service worker lives in src/sw.js so we can handle push notifications.
// injectManifest lets us keep that custom worker while still precaching the app.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Liste de courses du foyer',
        short_name: 'Courses',
        description: 'La liste de courses commune et synchronisée de la maison.',
        lang: 'fr',
        theme_color: '#46a02c',
        background_color: '#eef3e1',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}']
      },
      devOptions: {
        enabled: true,
        type: 'module'
      }
    })
  ]
})
