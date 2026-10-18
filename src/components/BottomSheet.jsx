import { useId, useLayoutEffect, useRef } from 'react'
import { EASE, EXIT_MS, useReducedMotion } from '../lib/motion'
import './PanelMotion.css'

const MAX_UP = 24
const UP_STIFF = 70
const CLOSE_DISTANCE = 96
const CLOSE_VELOCITY = 0.55
const SPRING = 'cubic-bezier(0.34, 1.42, 0.5, 1)'
const EASE_IN = 'cubic-bezier(0.4, 0, 1, 1)'

// Partagé avec SettingsMenu : un seul cycle de vie pour les animations et le
// focus des panneaux, y compris quand Réglages ouvre la confirmation de départ.
export function stopPanelMotion(node) {
  node?.getAnimations?.().forEach((animation) => {
    animation.onfinish = null
    animation.cancel()
  })
}

export function freezePanelMotion(node, properties) {
  const computed = getComputedStyle(node)
  const from = Object.fromEntries(properties.map((property) => [property, computed[property]]))
  // Poser la valeur VISUELLE avant de retirer l'animation évite le saut vers
  // sa valeur sous-jacente, lors d'un drag ou d'une inversion entrée/sortie.
  Object.assign(node.style, from)
  node.style.transition = 'none'
  node.style.animation = 'none'
  stopPanelMotion(node)
  return from
}

// `holdOpacity` (0..1, facultatif) : l'opacité ne bouge qu'après cette part de
// la durée — une surface qui se replie reste visible jusqu'au bout du geste.
export function animatePanelMotion(node, target, { duration, easing, reduced, delay = 0, onFinish, holdOpacity } = {}) {
  const from = freezePanelMotion(node, Object.keys(target))
  Object.assign(node.style, target)
  if (reduced || !node.animate || duration < 1) {
    onFinish?.()
    return
  }
  const frames = holdOpacity && 'opacity' in target
    ? [from, { opacity: from.opacity, offset: holdOpacity }, target]
    : [from, target]
  const animation = node.animate(frames, { duration, easing, delay, fill: 'both' })
  animation.onfinish = () => {
    animation.onfinish = null
    animation.cancel() // L'état final est déjà posé en inline.
    onFinish?.()
  }
}

const dialogs = []
const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

export function usePanelDialog(ref, active, onClose, returnFocusRef) {
  const titleId = useId()
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useLayoutEffect(() => {
    const node = ref.current
    if (!active || !node) return
    const previous = document.activeElement
    const parent = [...dialogs].reverse().find((entry) => entry.node.contains(previous)) || dialogs[dialogs.length - 1]
    const entry = { node, fallback: returnFocusRef?.current || parent?.fallback || previous }
    dialogs.push(entry)
    const heading = node.querySelector('h1, h2, h3')
    if (heading && !node.hasAttribute('aria-label') && !node.hasAttribute('aria-labelledby')) {
      if (!heading.id) heading.id = titleId
      node.setAttribute('aria-labelledby', heading.id)
    }
    const isTop = () => dialogs[dialogs.length - 1] === entry
    const focusPanel = () => node.focus({ preventScroll: true })
    const onKey = (event) => {
      if (!isTop() || event.defaultPrevented) return
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        closeRef.current?.()
      } else if (event.key === 'Tab') {
        const targets = [...node.querySelectorAll(FOCUSABLE)].filter((target) =>
          !target.disabled && target.tabIndex >= 0 && target.getClientRects().length &&
          !target.closest('[inert], [aria-hidden="true"]') && getComputedStyle(target).visibility !== 'hidden'
        )
        const index = targets.indexOf(document.activeElement)
        if (!targets.length) {
          event.preventDefault()
          focusPanel()
        } else if (event.shiftKey ? index <= 0 : index < 0 || index === targets.length - 1) {
          event.preventDefault()
          targets[event.shiftKey ? targets.length - 1 : 0].focus({ preventScroll: true })
        }
      }
    }
    const onFocus = (event) => {
      if (isTop() && !node.contains(event.target)) focusPanel()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('focusin', onFocus)
    focusPanel()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('focusin', onFocus)
      const wasTop = isTop()
      const index = dialogs.indexOf(entry)
      if (index !== -1) dialogs.splice(index, 1)
      const focused = document.activeElement
      if (wasTop && (node.contains(focused) || focused === document.body || !focused?.isConnected)) {
        const target = [returnFocusRef?.current, previous, entry.fallback].find((candidate) =>
          candidate?.isConnected && candidate !== document.body &&
          !candidate.closest('[inert], [aria-hidden="true"]')
        )
        target?.focus?.({ preventScroll: true })
      }
    }
  }, [active, ref, returnFocusRef, titleId])
}

export default function BottomSheet({ onClose, className = '', children }) {
  const overlayRef = useRef(null)
  const sheetRef = useRef(null)
  const drag = useRef(null)
  const closing = useRef(false)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const reduced = useReducedMotion()
  const reducedRef = useRef(reduced)
  reducedRef.current = reduced

  function releaseDrag() {
    const current = drag.current
    drag.current = null // releasePointerCapture peut déclencher lostpointercapture.
    current?.cleanup()
  }

  function requestClose() {
    if (closing.current) return
    closing.current = true
    releaseDrag()
    animatePanelMotion(overlayRef.current, { opacity: '0' }, {
      duration: EXIT_MS, easing: EASE, reduced: reducedRef.current,
    })
    animatePanelMotion(sheetRef.current, { transform: 'translateY(100%)' }, {
      duration: EXIT_MS, easing: EASE_IN, reduced: reducedRef.current,
      onFinish: () => closeRef.current(),
    })
  }

  usePanelDialog(sheetRef, true, requestClose)

  useLayoutEffect(() => {
    const sheet = sheetRef.current
    const overlay = overlayRef.current
    closing.current = false
    sheet.style.transform = 'translateY(100%)'
    overlay.style.opacity = '0'
    animatePanelMotion(sheet, { transform: 'translateY(0)' }, {
      duration: 360, easing: SPRING, reduced: reducedRef.current,
    })
    animatePanelMotion(overlay, { opacity: '1' }, {
      duration: 250, easing: EASE, reduced: reducedRef.current,
    })
    return () => {
      releaseDrag()
      stopPanelMotion(sheet)
      stopPanelMotion(overlay)
    }
  }, [])

  useLayoutEffect(() => {
    if (!reduced) return
    // Une préférence modifiée pendant une animation la termine immédiatement,
    // sans attendre un timer ni poursuivre le mouvement en JavaScript.
    overlayRef.current?.getAnimations?.().forEach((animation) => animation.finish())
    sheetRef.current?.getAnimations?.().forEach((animation) => animation.finish())
  }, [reduced])

  function returnToRest() {
    releaseDrag()
    if (closing.current) return
    animatePanelMotion(sheetRef.current, { transform: 'translateY(0)' }, {
      duration: 340, easing: SPRING, reduced: reducedRef.current,
    })
  }

  function down(event) {
    if (closing.current || drag.current || event.isPrimary === false || event.button !== 0) return
    const sheet = sheetRef.current
    const { transform } = freezePanelMotion(sheet, ['transform'])
    const baseY = transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m42
    const handle = event.currentTarget
    const pointerId = event.pointerId
    const current = {
      startY: event.clientY, lastY: event.clientY, lastT: event.timeStamp,
      vy: 0, dy: 0, pid: pointerId, baseY,
      cleanup: () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        window.removeEventListener('pointercancel', cancel)
        window.removeEventListener('blur', cancel)
        document.removeEventListener('visibilitychange', visibility)
        try {
          if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId)
        } catch { /* Le pointeur peut déjà avoir été libéré par le navigateur. */ }
      },
    }
    const cancel = (event) => {
      if (drag.current === current && (event?.pointerId == null || event.pointerId === current.pid)) returnToRest()
    }
    const visibility = () => { if (document.hidden) cancel() }
    drag.current = current
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('blur', cancel)
    document.addEventListener('visibilitychange', visibility)
    try { handle.setPointerCapture(pointerId) } catch { /* Les listeners window gardent le geste suivi. */ }
  }

  function move(event) {
    const current = drag.current
    if (!current || event.pointerId !== current.pid) return
    const dy = event.clientY - current.startY
    const dt = event.timeStamp - current.lastT
    if (dt > 0) {
      current.vy = current.vy * 0.4 + ((event.clientY - current.lastY) / dt) * 0.6
      current.lastY = event.clientY
      current.lastT = event.timeStamp
    }
    current.dy = dy
    const offset = dy >= 0 ? dy : -(MAX_UP * -dy) / (-dy + UP_STIFF)
    sheetRef.current.style.transform = `translateY(${current.baseY + offset}px)`
  }

  function up(event) {
    const current = drag.current
    if (!current || event.pointerId !== current.pid) return
    // Un flick suivi d'une pause ne doit pas conserver une ancienne vélocité.
    const velocity = event.timeStamp - current.lastT < 100 ? current.vy : 0
    const distance = event.clientY - current.startY
    if (distance > CLOSE_DISTANCE || (velocity > CLOSE_VELOCITY && distance > 24)) requestClose()
    else returnToRest()
  }

  return (
    <div className="modal-overlay panel-overlay" ref={overlayRef} onClick={requestClose}>
      <div
        className={'modal' + (className ? ' ' + className : '')}
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <span
          className="modal-grip"
          aria-hidden="true"
          onPointerDown={down}
          onLostPointerCapture={(event) => {
            if (drag.current?.pid === event.pointerId) returnToRest()
          }}
        />
        {typeof children === 'function' ? children(requestClose) : children}
      </div>
    </div>
  )
}
