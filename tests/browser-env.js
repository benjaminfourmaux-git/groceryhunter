// Substitut limité à ce banc de test ; aucune préférence système n'est changée.
const nativeMedia = window.matchMedia.bind(window)
export const reduceMedia = new EventTarget()
reduceMedia.matches = false
window.matchMedia = (query) => query === '(prefers-reduced-motion: reduce)' ? reduceMedia : nativeMedia(query)

const nativeViewport = window.visualViewport
const viewport = new EventTarget()
let forcedHeight = null
for (const property of ['width', 'height', 'offsetTop', 'offsetLeft', 'pageTop', 'pageLeft', 'scale']) {
  Object.defineProperty(viewport, property, { get: () => property === 'height' && forcedHeight != null ? forcedHeight : nativeViewport?.[property] ?? (property === 'height' ? window.innerHeight : property === 'width' ? window.innerWidth : 0) })
}
nativeViewport?.addEventListener('resize', () => viewport.dispatchEvent(new Event('resize')))
nativeViewport?.addEventListener('scroll', () => viewport.dispatchEvent(new Event('scroll')))
Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => viewport })
export function keyboardHeight(height) {
  forcedHeight = height == null ? null : document.documentElement.clientHeight - height
  viewport.dispatchEvent(new Event('resize'))
}
