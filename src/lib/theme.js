import { useSyncExternalStore } from 'react'
import { EASE, reducedMotion } from './motion'

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

let themeTransition = null
function apply(notify) {
  const change = () => withoutTransitions(() => { setTheme(); notify?.() })
  themeTransition?.skipTransition()
  if (reducedMotion()) { change(); return }
  if (document.startViewTransition) {
    document.documentElement.classList.add('theme-transition')
    const transition = document.startViewTransition(change)
    themeTransition = transition
    transition.ready.catch(() => {})
    transition.finished.finally(() => {
      if (themeTransition !== transition) return
      themeTransition = null
      document.documentElement.classList.remove('theme-transition')
    }).catch(() => {})
    return
  }
  // Safari plus ancien : fondu des surfaces, sans imposer une API récente.
  const nodes = [...document.querySelectorAll('html, body, .app, .appbar, .sky-fill, .dock-ground, .modal, .morph, .item, .hist-item, input, .seg, .seg-btn, .onboarding-screen, .onboarding-access, .onboarding-sky, .onboarding-primary, .onboarding-tabs, .buy-dot, .qty-badge, .tabbar, .tab-indicator')]
  const colors = nodes.map((node) => {
    const style = getComputedStyle(node)
    return { backgroundColor: style.backgroundColor, color: style.color, fill: style.fill }
  })
  change()
  const next = nodes.map((node) => {
    const style = getComputedStyle(node)
    return { backgroundColor: style.backgroundColor, color: style.color, fill: style.fill }
  })
  nodes.forEach((node, i) => {
    const animation = node.animate([colors[i], next[i]], { duration: 180, easing: EASE })
    animation.onfinish = () => animation.cancel()
  })
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
  setThemePref(ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length])
}

// Choix direct (sélecteur Clair / Soir des réglages).
export function setThemePref(next) {
  if (!ORDER.includes(next) || next === pref) return
  pref = next
  try {
    localStorage.setItem(KEY, pref)
  } catch {
    /* stockage indisponible : le choix vaut pour la session */
  }
  apply(() => listeners.forEach((l) => l()))
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

// Thème réellement affiché ('light' | 'dark') : le choix forcé, sinon celui du
// téléphone (suivi en direct en mode auto).
const darkQuery = typeof window !== 'undefined' ? window.matchMedia?.('(prefers-color-scheme: dark)') : null

export function useEffectiveTheme() {
  const p = useThemePref()
  const systemDark = useSyncExternalStore(
    (l) => {
      darkQuery?.addEventListener?.('change', l)
      return () => darkQuery?.removeEventListener?.('change', l)
    },
    () => !!darkQuery?.matches
  )
  return p === 'auto' ? (systemDark ? 'dark' : 'light') : p
}
