// Appui discret au centre du bouton. Aucun contrôle ne suit le doigt ; les
// gestes dédiés (cases, onglets, poignée) gardent leur propre retour tactile.
export function initPress() {
  let button = null
  let pointer = null
  let startX = 0
  let startY = 0
  function release() {
    button?.removeAttribute('data-pressing')
    button = null
    pointer = null
  }
  function down(e) {
    if (!e.isPrimary || e.button !== 0) return
    release()
    const target = e.target.closest?.('button')
    if (!target || target.disabled || target.closest('.tabbar') || target.classList.contains('buy-check')) return
    button = target
    pointer = e.pointerId
    startX = e.clientX
    startY = e.clientY
    button.setAttribute('data-pressing', '')
  }
  function move(e) {
    if (e.pointerId !== pointer) return
    if (Math.hypot(e.clientX - startX, e.clientY - startY) > 10) release()
  }
  const opts = { passive: true }
  document.addEventListener('pointerdown', down, opts)
  document.addEventListener('pointermove', move, opts)
  document.addEventListener('pointerup', release, opts)
  document.addEventListener('pointercancel', release, opts)
  window.addEventListener('blur', release)
  return () => {
    release()
    document.removeEventListener('pointerdown', down)
    document.removeEventListener('pointermove', move)
    document.removeEventListener('pointerup', release)
    document.removeEventListener('pointercancel', release)
    window.removeEventListener('blur', release)
  }
}
