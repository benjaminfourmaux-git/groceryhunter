import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Config dédiée aux tests : on ne charge pas le plugin PWA, inutile ici et
// bruyant (il régénère un service worker à chaque exécution).
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    restoreMocks: true,
  },
})
