// iOS fait défiler toute la page pour « montrer » un champ touché, avant que
// l'écran ne se recale sur la zone visible → sursaut. On donne le focus
// nous-mêmes en plaçant un instant le champ tout en haut : Safari le juge
// visible et ne défile pas (même technique que react-aria).
// Gestionnaires à poser sur un conteneur : ils agissent sur le champ touché.
export const IS_IOS =
  typeof navigator !== 'undefined' &&
  (/iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

const FIELD = 'input:not([type="checkbox"]):not([type="radio"]):not([type="submit"]), textarea'

export function iosFocusHandlers() {
  let start = null
  return {
    onTouchStart(e) {
      const p = e.touches[0]
      start = p ? { x: p.clientX, y: p.clientY } : null
    },
    onTouchCancel() {
      start = null
    },
    onTouchEnd(e) {
      const from = start
      start = null
      const el = e.target.closest?.(FIELD)
      if (!IS_IOS || !el || el.disabled || document.activeElement === el || !from) return
      const p = e.changedTouches[0]
      if (p && (Math.abs(p.clientX - from.x) > 10 || Math.abs(p.clientY - from.y) > 10)) return
      e.preventDefault()
      el.style.transform = 'translateY(-2000px)'
      el.focus({ preventScroll: true })
      requestAnimationFrame(() => { el.style.transform = '' })
    },
  }
}
