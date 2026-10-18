import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'
import { useLang } from '../lib/i18n'

const IS_IOS =
  typeof navigator !== 'undefined' &&
  (/iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

// Barre d'ajout — désormais en bas de l'écran (au-dessus des onglets), puisqu'il
// n'y a plus de bouton « J'ai fait les courses ».
export default function AddBar({ onAdd }) {
  const { t } = useLang()
  const [name, setName] = useState('')
  const [qty, setQty] = useState('')

  // Garde anti double-ajout : le submit (touche « OK » bleue) et le blur
  // déclenché par la fermeture du clavier peuvent tirer quasi simultanément.
  const adding = useRef(false)
  const touch = useRef(null)
  const timers = useRef(new Set())
  const focusFrame = useRef(0)
  function defer(callback, ms) {
    const timer = setTimeout(() => { timers.current.delete(timer); callback() }, ms)
    timers.current.add(timer)
  }
  useEffect(() => () => {
    timers.current.forEach(clearTimeout)
    cancelAnimationFrame(focusFrame.current)
  }, [])

  function commitAdd() {
    const n = name.trim()
    if (!n || adding.current) return
    adding.current = true
    onAdd(n, qty)
    setName('')
    setQty('')
    defer(() => { adding.current = false }, 120)
  }

  // Touche « OK » / Entrée (plus de <form> : Safari s'en sert pour proposer
  // le remplissage automatique de contacts au-dessus du clavier).
  function onKeyDown(e) {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
    e.preventDefault()
    commitAdd()
    e.currentTarget.blur()
  }

  // Fermer le clavier (bouton « OK » iOS, tap ailleurs) ajoute l'article ; sauf
  // si le focus passe à l'autre champ de la barre (on complète la quantité).
  function onFieldBlur() {
    defer(() => {
      const active = document.activeElement
      if (active && active.closest && active.closest('.add-bar')) return
      commitAdd()
    }, 50)
  }

  // iOS fait défiler la page pour « montrer » un champ placé en bas, avant que
  // l'app ne se recale sur la zone visible → sursaut. On fait le focus nous-mêmes
  // en plaçant un instant le champ tout en haut : Safari le juge visible et ne
  // défile pas (même technique que react-aria). L'app se redimensionne ensuite
  // au-dessus du clavier via le VisualViewport.
  function onTouchStart(e) {
    const p = e.touches[0]
    touch.current = p ? { x: p.clientX, y: p.clientY } : null
  }
  function onTouchEnd(e) {
    const el = e.currentTarget
    const start = touch.current
    touch.current = null
    if (!IS_IOS || document.activeElement === el || !start) return
    const p = e.changedTouches[0]
    if (p && (Math.abs(p.clientX - start.x) > 10 || Math.abs(p.clientY - start.y) > 10)) return
    e.preventDefault()
    el.style.transform = 'translateY(-2000px)'
    el.focus({ preventScroll: true })
    cancelAnimationFrame(focusFrame.current)
    focusFrame.current = requestAnimationFrame(() => { el.style.transform = '' })
  }

  const fieldProps = {
    onBlur: onFieldBlur,
    onKeyDown,
    onTouchStart,
    onTouchEnd,
    onTouchCancel: () => { touch.current = null },
    enterKeyHint: 'done',
    autoComplete: 'off',
    'data-form-type': 'other',
    'data-lpignore': 'true',
  }

  return (
    <div className="add-bar" role="group">
      <input
        className="add-name"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('add_item_ph')}
        aria-label={t('aria_item_name')}
        maxLength={60}
        {...fieldProps}
      />
      <input
        className="add-qty"
        type="text"
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        placeholder={t('qty_ph')}
        aria-label={t('aria_qty')}
        maxLength={16}
        {...fieldProps}
      />
      <button
        type="button"
        className="add-btn"
        aria-label={t('aria_add')}
        disabled={!name.trim()}
        onPointerDown={(e) => e.preventDefault()}
        onClick={commitAdd}
      >
        <Icon name="plus" size={22} strokeWidth={2.4} />
      </button>
    </div>
  )
}
