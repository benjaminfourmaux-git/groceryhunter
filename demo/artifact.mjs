// ============================================================================
//  Assemble dist-demo/artifact.html à partir du bundle de la démonstration.
//
//  Un artefact Claude n'est pas une page complète mais un FRAGMENT : pas de
//  <html>, pas de <head>. Les feuilles de style externes y sont bloquées sauf
//  Google Fonts, et les images ou requêtes réseau le sont toutes. On inline
//  donc la CSS, on garde le lien des polices, et app.js part en fichier joint.
//
//  Usage : npx vite build --config demo/vite.config.js && node demo/artifact.mjs
// ============================================================================
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist-demo')
const css = fs.readFileSync(path.join(DIST, 'app.css'), 'utf8')

const POLICES =
  'https://fonts.googleapis.com/css2?family=Klee+One:wght@400;600&family=Zen+Maru+Gothic:wght@400;500;700&display=swap'

const page = `<title>Huntly</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${POLICES}">
<style>
/* L'app gère elle-même les zones sûres (elle est née PWA) : on neutralise
   celles du gabarit pour ne pas les compter deux fois. */
:root { padding: 0; }

${css}
</style>

<div id="root"></div>
<script type="module" src="app.js"></script>
`

fs.writeFileSync(path.join(DIST, 'artifact.html'), page)
console.log('dist-demo/artifact.html —', (page.length / 1024).toFixed(0), 'Kio (+ app.js en fichier joint)')
