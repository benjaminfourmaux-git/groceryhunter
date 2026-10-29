// ============================================================================
//  Compilation de la démonstration publiée en artefact.
//
//  Le code de l'app n'est PAS modifié : ce fichier intercepte seulement quatre
//  modules à la résolution et les remplace par leurs doublures. Tout le reste
//  — composants, styles, logique — est celui de la branche.
// ============================================================================
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const ICI = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.resolve(ICI, '../src')

const DOUBLURES = {
  [path.join(SRC, 'lib/api.js')]: path.join(ICI, 'fake-api.js'),
  [path.join(SRC, 'supabaseClient.js')]: path.join(ICI, 'fake-supabase.js'),
  [path.join(SRC, 'lib/push.js')]: path.join(ICI, 'fake-push.js'),
  [path.join(SRC, 'lib/config.js')]: path.join(ICI, 'fast-config.js'),
}

// On remplace par chemin RÉSOLU et non par spécificateur : les imports de l'app
// sont relatifs (« ./lib/api », « ../lib/config »), un alias ne les verrait pas.
function doublures() {
  return {
    name: 'demo-doublures',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!importer || source.startsWith('\0')) return null
      const resolu = await this.resolve(source, importer, { ...options, skipSelf: true })
      if (!resolu) return null
      return DOUBLURES[path.normalize(resolu.id.split('?')[0])] ?? null
    },
  }
}

export default defineConfig({
  root: ICI,
  base: './',
  plugins: [doublures(), react()],
  build: {
    outDir: path.resolve(ICI, '../dist-demo'),
    emptyOutDir: true,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: {
      output: {
        entryFileNames: 'app.js',
        chunkFileNames: 'app-[name].js',
        assetFileNames: 'app.[ext]',
      },
    },
  },
})
