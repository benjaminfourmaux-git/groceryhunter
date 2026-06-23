// ============================================================================
//  Effet « press organique » : au maintien d'un bouton, léger grossissement et
//  suivi du doigt ; retour élastique au relâchement. Délégué au document pour
//  couvrir tous les <button> sans toucher chaque composant.
//  Les onglets (.tabbar) sont exclus : ils ont leur propre interaction (slide).
// ============================================================================

const SCALE = 1.045 // « léger grossissement »
const FOLLOW = 0.18 // fraction du déplacement du doigt suivie
const MAX = 9 // décalage maximum en px

export function initPress() {
  let el = null
  let pid = null
  let cx = 0
  let cy = 0

  function down(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const btn = e.target.closest('button')
    // Onglets et boutons de l'en-tête exclus : ils gardent un press simple.
    if (!btn || btn.disabled || btn.closest('.tabbar') || btn.closest('.appbar')) return

    el = btn
    pid = e.pointerId
    const r = btn.getBoundingClientRect()
    cx = r.left + r.width / 2
    cy = r.top + r.height / 2
    btn.style.willChange = 'transform'
    btn.style.transition = 'transform .14s cubic-bezier(.34,1.45,.5,1)'
    btn.style.transform = `scale(${SCALE})`
    requestAnimationFrame(() => {
      if (el === btn) btn.style.transition = 'transform .06s linear'
    })
  }

  function move(e) {
    if (!el || e.pointerId !== pid) return
    const tx = clamp((e.clientX - cx) * FOLLOW)
    const ty = clamp((e.clientY - cy) * FOLLOW)
    el.style.transform = `translate(${tx}px, ${ty}px) scale(${SCALE})`
  }

  function release() {
    if (!el) return
    const btn = el
    el = null
    pid = null
    btn.style.transition = 'transform .34s cubic-bezier(.34,1.4,.5,1)'
    btn.style.transform = ''
    const done = () => {
      btn.style.transition = ''
      btn.style.willChange = ''
      btn.removeEventListener('transitionend', done)
    }
    btn.addEventListener('transitionend', done)
  }

  function clamp(v) {
    return Math.max(-MAX, Math.min(MAX, v))
  }

  const opts = { passive: true }
  document.addEventListener('pointerdown', down, opts)
  document.addEventListener('pointermove', move, opts)
  document.addEventListener('pointerup', release, opts)
  document.addEventListener('pointercancel', release, opts)

  return () => {
    document.removeEventListener('pointerdown', down)
    document.removeEventListener('pointermove', move)
    document.removeEventListener('pointerup', release)
    document.removeEventListener('pointercancel', release)
  }
}
