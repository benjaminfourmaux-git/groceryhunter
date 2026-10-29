import { useRef, useState } from 'react'
import Icon from './Icon'

const TAP_SLOP = 6 // px tolérés avant d'annuler l'appui

// Le rond de sélection de l'inventaire. Volontairement distinct de la case
// « acheté » de la liste (ShoppingList/BuyCheck) : pas d'anneau, pas de pétales,
// et la prairie plutôt que le coquelicot — cocher ici ne veut pas dire
// « acheté » mais « sélectionné », et le rouge reste réservé à l'achat et à la
// suppression.
//
// Tap uniquement : dès que le doigt bouge de plus de TAP_SLOP, l'appui est
// annulé, pour que le défilement de la liste ne coche rien au passage.
export default function CheckDot({ checked, onToggle, label }) {
  const press = useRef(null)
  const [pressed, setPressed] = useState(false)

  function onPointerDown(e) {
    if (e.isPrimary === false || e.button !== 0) return
    press.current = { x: e.clientX, y: e.clientY, pid: e.pointerId, released: false }
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
  function onPointerUp(e) {
    const p = press.current
    if (!p || e.pointerId !== p.pid) return
    if (Math.abs(e.clientX - p.x) > TAP_SLOP || Math.abs(e.clientY - p.y) > TAP_SLOP) press.current = null
    else p.released = true
    setPressed(false)
  }
  function cancel() {
    press.current = null
    setPressed(false)
  }
  function onPointerLeave(e) {
    // Au toucher, pointerout/leave peut précéder le clic de compatibilité qui
    // suit pointerup. Le doigt a déjà été relevé : ce n'est plus un glissement
    // à annuler, sinon le tap resterait sans effet.
    if (press.current?.released) return
    cancel(e)
  }
  function onClick(e) {
    // e.detail === 0 : activation au clavier (Entrée / Espace), toujours valide.
    const valid = e.detail === 0 || press.current?.released
    press.current = null
    if (valid) onToggle()
  }

  return (
    <button
      type="button"
      className={'select-dot' + (checked ? ' on' : '') + (pressed ? ' pressed' : '')}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={cancel}
      onPointerLeave={onPointerLeave}
      onClick={onClick}
      aria-pressed={checked}
      aria-label={label}
    >
      <span className="select-dot-circle" aria-hidden="true">
        {checked && <Icon name="check" size={13} strokeWidth={3} />}
      </span>
    </button>
  )
}
