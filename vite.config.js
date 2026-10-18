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
      includeAssets: ['app-icon-192.png', 'app-icon-512.png', 'apple-touch-icon.png', 'favicon-16.png', 'favicon-32.png'],
      manifest: {
        name: 'Huntly',
        short_name: 'Huntly',
        description: 'La liste de courses commune et synchronisée de la maison.',
        lang: 'fr',
        theme_color: '#9ECFE4',
        background_color: '#F2F0E6',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'app-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'app-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }
        ]
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}']
      },
      devOptions: {
        // Désactivé en dev : le SW cachait les assets et masquait les
        // changements (« un reload en retard »). HMR direct, sans cache.
        // À repasser à true pour tester le comportement PWA/offline réel.
        enabled: false,
        type: 'module'
      }
    })
  ]
})
