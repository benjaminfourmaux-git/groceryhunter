import { useRef, useState } from 'react'
import Icon from './Icon'

const RING_R = 16
const RING_CIRC = 2 * Math.PI * RING_R // circonférence de l'anneau de compte à rebours
const TAP_SLOP = 6 // px tolérés avant d'annuler l'appui

// La case ronde, partagée par la liste et l'inventaire.
//
//   liste      → tone="danger" + fraction : rouge et anneau qui se vide sur T1,
//                le temps qu'il reste avant que l'article file à l'inventaire.
//   inventaire → tone="brand", sans anneau : elle ne dit pas « acheté » mais
//                « sélectionné », et le rouge reste réservé à l'achat et à la
//                suppression.
//
// Tap uniquement : dès que le doigt bouge de plus de TAP_SLOP, l'appui est
// annulé — glisser depuis la case ne coche rien et ne lance aucun geste.
export default function CheckDot({ checked, fraction = 0, tone = 'danger', onToggle, label }) {
  const press = useRef(null)
  const [pressed, setPressed] = useState(false)

  function onPointerDown(e) {
    press.current = { x: e.clientX, y: e.clientY, pid: e.pointerId }
    setPressed(true)
  }
  function onPointerMove(e) {
    const p = press.current
    if (!p || e.pointerId !== p.pid) return
    if (Math.abs(e.clientX - p.x) > TAP_SLOP || Math.abs(e.clientY - p.y) > TAP_SLOP) {
      press.current = null
      setPressed(false)
    }
  }
  function release() {
    setPressed(false)
  }
  function onClick(e) {
    // e.detail === 0 : activation au clavier (Entrée / Espace), toujours valide.
    const valid = e.detail === 0 || press.current
    press.current = null
    if (valid) onToggle()
  }

  return (
    <button
      type="button"
      className={
        'buy-check tone-' + tone + (checked ? ' on' : '') + (pressed ? ' pressed' : '')
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={release}
      onPointerCancel={() => { press.current = null; release() }}
      onPointerLeave={() => { press.current = null; release() }}
      onClick={onClick}
      aria-pressed={checked}
      aria-label={label}
    >
      {checked && fraction > 0 && (
        <svg className="buy-ring" viewBox="0 0 40 40" aria-hidden="true">
          <circle className="buy-ring-track" cx="20" cy="20" r={RING_R} />
          <circle
            className="buy-ring-fill"
            cx="20"
            cy="20"
            r={RING_R}
            strokeDasharray={RING_CIRC}
            strokeDashoffset={RING_CIRC * (1 - fraction)}
          />
        </svg>
      )}
      <span className="buy-dot" aria-hidden="true">
        {checked && <Icon name="check" size={13} strokeWidth={3} />}
      </span>
    </button>
  )
}
