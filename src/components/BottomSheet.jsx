import { useRef } from 'react'

// Volet (bottom sheet) que l'on ferme en glissant la POIGNÉE vers le bas — même
// esprit que la suppression d'un article. Vers le haut : grande résistance +
// butée (MAX_UP), pour ne pas dépasser l'overshoot du ressort d'ouverture.
// Courbes en littéral : var() dans une transition posée en JS ne se parse pas
// sur Safari mobile.
const MAX_UP = 24 // butée haute (px) ≈ overshoot du slide-up
const UP_STIFF = 70 // raideur de la résistance vers le haut (plus grand = plus dur)
const CLOSE_DISTANCE = 96 // glissé bas (px) au-delà duquel on ferme
const CLOSE_VELOCITY = 0.55 // ou flick vif vers le bas (px/ms)
const SPRING = 'cubic-bezier(0.34, 1.42, 0.5, 1)'
const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)'
const EASE_IN = 'cubic-bezier(0.4, 0, 1, 1)'

export default function BottomSheet({ onClose, className = '', children }) {
  const overlayRef = useRef(null)
  const sheetRef = useRef(null)
  const drag = useRef(null)
  const closing = useRef(false)

  // Fermeture animée : le volet redescend hors-champ (depuis sa position
  // courante, glissée ou non) et l'overlay s'efface, puis React démonte.
  function requestClose() {
    if (closing.current) return
    closing.current = true
    const overlay = overlayRef.current
    const sheet = sheetRef.current
    if (overlay) {
      overlay.style.transition = `opacity 0.3s ${EASE_OUT}`
      overlay.style.opacity = '0'
    }
    let done = false
    const finish = () => {
      if (done) return
      done = true
      onClose()
    }
    if (sheet) {
      sheet.style.animation = 'none'
      sheet.style.transition = `transform 0.3s ${EASE_IN}`
      sheet.style.transform = 'translateY(100%)'
      sheet.addEventListener('transitionend', finish)
    }
    setTimeout(finish, 360) // filet de sécurité si transitionend ne tire pas
  }

  function down(e) {
    if (closing.current) return
    const sheet = sheetRef.current
    drag.current = {
      startY: e.clientY,
      lastY: e.clientY,
      lastT: e.timeStamp,
      vy: 0,
      pid: e.pointerId,
      dy: 0,
    }
    sheet.style.animation = 'none' // fige le slide-up s'il joue encore
    sheet.style.transition = 'none'
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* noop */ }
  }

  function move(e) {
    const d = drag.current
    if (!d || e.pointerId !== d.pid) return
    const dy = e.clientY - d.startY
    const dt = e.timeStamp - d.lastT
    if (dt > 0) {
      d.vy = d.vy * 0.4 + ((e.clientY - d.lastY) / dt) * 0.6 // vélocité lissée
      d.lastY = e.clientY
      d.lastT = e.timeStamp
    }
    d.dy = dy
    // Bas : suivi 1:1. Haut : résistance asymptotique bornée à MAX_UP.
    const u = -dy
    const y = dy >= 0 ? dy : -(MAX_UP * u) / (u + UP_STIFF)
    sheetRef.current.style.transform = `translateY(${y}px)`
  }

  function up(e) {
    const d = drag.current
    if (!d || e.pointerId !== d.pid) return
    drag.current = null
    const sheet = sheetRef.current
    const commit = d.dy > CLOSE_DISTANCE || (d.vy > CLOSE_VELOCITY && d.dy > 24)
    if (commit) {
      requestClose()
    } else {
      // En deçà du seuil : retour à sa place avec un léger ressort.
      sheet.style.transition = `transform 0.34s ${SPRING}`
      sheet.style.transform = 'translateY(0)'
    }
  }

  const grip = {
    onPointerDown: down,
    onPointerMove: move,
    onPointerUp: up,
    onPointerCancel: up,
  }

  return (
    <div className="modal-overlay" ref={overlayRef} onClick={requestClose}>
      <div
        className={'modal' + (className ? ' ' + className : '')}
        ref={sheetRef}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="modal-grip" aria-hidden="true" {...grip} />
        {typeof children === 'function' ? children(requestClose) : children}
      </div>
    </div>
  )
}
