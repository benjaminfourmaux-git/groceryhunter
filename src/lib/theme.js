import { useSyncExternalStore } from 'react'

// Thème « Grand ciel » : 'auto' suit le réglage clair/sombre du téléphone ;
// 'light' (plein jour) ou 'dark' (crépuscule) le forcent. Le choix est propre à
// l'appareil (localStorage) et s'applique via <html data-theme="…">.
const KEY = 'theme'
const ORDER = ['auto', 'light', 'dark']
const BAR_COLOR = { light: '#9ECFE4', dark: '#23375C' } // couleur de la barre d'état (= ciel)

let pref = read()
const listeners = new Set()

function read() {
  try {
    const v = localStorage.getItem(KEY)
    return ORDER.includes(v) ? v : 'auto'
  } catch {
    return 'auto'
  }
}

// Bascule sans transitions : sinon les éléments qui animent leur couleur
// restent figés sur celles de l'ancien thème. On coupe, on force le recalcul
// des styles, puis on rétablit (plus rien ne change, donc rien ne s'anime).
function withoutTransitions(change) {
  const root = document.documentElement
  root.classList.add('theme-switching')
  change()
  void document.body?.offsetHeight
  root.classList.remove('theme-switching')
}

function apply() {
  withoutTransitions(setTheme)
}

function setTheme() {
  const root = document.documentElement
  if (pref === 'auto') delete root.dataset.theme
  else root.dataset.theme = pref
  // Les deux <meta name="theme-color"> (clair / sombre) : forcés sur le thème
  // choisi, ou rendus à leur couleur propre en mode auto.
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    const own = (m.getAttribute('media') || '').includes('dark') ? 'dark' : 'light'
    m.setAttribute('content', BAR_COLOR[pref === 'auto' ? own : pref])
  })
}

export function initTheme() {
  setTheme()
  // Mode auto : même précaution quand le téléphone passe en clair / sombre.
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    if (pref === 'auto') withoutTransitions(() => {})
  })
}

export function cycleTheme() {
  pref = ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length]
  try {
    localStorage.setItem(KEY, pref)
  } catch {
    /* stockage indisponible : le choix vaut pour la session */
  }
  apply()
  listeners.forEach((l) => l())
}

export function useThemePref() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => pref
  )
}
