import { useLayoutEffect, useRef, useState } from 'react'
import Icon from './Icon'
import Avatar from './Avatar'
import { useLang } from '../lib/i18n'
import { collapseRow, resetRow } from '../lib/swipeExit'

const COMMIT_RATIO = 0.4 // fraction de la largeur de ligne à atteindre pour supprimer
const FLICK_VELOCITY = 1.2 // px/ms vers la gauche : un geste vif supprime même court
const FLICK_MIN_DX = 24 // mais il faut un déplacement minimal, pour éviter le faux geste

// Chaque ligne gère son propre swipe. Glisser au-delà du seuil = suppression ;
// en deçà, la ligne revient. Aucun bouton à re-cliquer.
function SwipeRow({ it, onDelete, t }) {
  const rowRef = useRef(null)
  const fgRef = useRef(null)
  const drag = useRef(null)
  const removing = useRef(false)

  function down(e) {
    if (removing.current) return
    drag.current = {
      startX: e.clientX,
      startY: e.clientY,
      width: rowRef.current.clientWidth,
      axis: null, // null = indécis, 'h' = horizontal, 'v' = vertical (scroll)
      pid: e.pointerId,
      x: 0, // dernière position (px, négative vers la gauche)
      lastX: e.clientX,
      lastT: e.timeStamp,
      vx: 0, // vélocité lissée (px/ms ; négative vers la gauche)
    }
    fgRef.current.style.transition = 'none'
    try { fgRef.current.setPointerCapture(e.pointerId) } catch { /* noop */ }
  }

  function move(e) {
    const d = drag.current
    if (!d || e.pointerId !== d.pid) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY

    // Verrouillage d'axe au 1er mouvement significatif.
    if (d.axis === null && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
      d.axis = Math.abs(dy) > Math.abs(dx) ? 'v' : 'h'
    }
    if (d.axis !== 'h') return // scroll vertical natif

    // Vélocité lissée à partir de l'échantillon précédent : un lissage léger
    // gomme le bruit du pointeur tout en restant réactif au flick final.
    const dt = e.timeStamp - d.lastT
    if (dt > 0) {
      const inst = (e.clientX - d.lastX) / dt
      d.vx = d.vx * 0.4 + inst * 0.6
      d.lastX = e.clientX
      d.lastT = e.timeStamp
    }

    const x = Math.max(-d.width, Math.min(0, dx)) // gauche uniquement
    d.x = x
    fgRef.current.style.transform = `translateX(${x}px)`
    rowRef.current.toggleAttribute('data-armed', -x >= d.width * COMMIT_RATIO)
  }

  function up(e) {
    const d = drag.current
    if (!d || e.pointerId !== d.pid) return
    drag.current = null

    const fg = fgRef.current
    const row = rowRef.current
    fg.style.transition = '' // ré-active la transition CSS (ressort)

    // Deux façons de valider : distance franchie (seuil) OU geste vif (flick)
    // vers la gauche au-delà d'un déplacement minimal. L'inertie du flick
    // « projette » l'article hors-champ même si le doigt s'est peu déplacé.
    const flicked = d.vx <= -FLICK_VELOCITY && -d.x >= FLICK_MIN_DX
    const commit = d.axis === 'h' && (row.hasAttribute('data-armed') || flicked)

    if (commit) {
      // Validé : on projette l'article hors-champ, puis on supprime. La durée
      // suit la vitesse du geste (le reste à parcourir ÷ la vélocité) → un flick
      // vif file en ~120 ms, un glissé au seuil sort en douceur. Courbe
      // décélérante (ease-out) pour une sensation d'inertie, pas de ressort.
      removing.current = true
      const speed = Math.max(Math.abs(d.vx), 0.3) // px/ms, plancher pour le glissé lent
      const remaining = d.width + d.x // distance restante jusqu'au bord
      const dur = Math.min(360, Math.max(120, remaining / speed))
      fg.style.transition = `transform ${Math.round(dur)}ms cubic-bezier(0.22, 1, 0.36, 1)`
      fg.style.transform = `translateX(-${d.width}px)`
      let called = false
      const finish = async () => {
        if (called) return
        called = true
        fg.removeEventListener('transitionend', finish)
        try {
          await new Promise((res) => collapseRow(row, res)) // repli fluide
          await onDelete(it.id) // succès → le composant est démonté
        } catch {
          removing.current = false
          resetRow(row, fg)
        }
      }
      fg.addEventListener('transitionend', finish)
      setTimeout(finish, 400) // filet de sécurité si transitionend ne tire pas
    } else {
      // En deçà du seuil : retour à la position initiale.
      fg.style.transform = ''
      row.removeAttribute('data-armed')
    }
  }

  return (
    <li ref={rowRef} data-flip-id={it.id} className="swipe-row">
      {/* Fond rouge plein, révélé en continu sous l'article. Le bouton (strip
          droite) sert l'accès clavier ; au pointeur, c'est la distance qui décide. */}
      <div className="swipe-bg">
        <button
          type="button"
          className="swipe-delete"
          onClick={() => onDelete(it.id)}
          aria-label={t('aria_delete')}
        >
          <span className="swipe-bg-icon">
            <Icon name="trash" size={20} />
          </span>
        </button>
      </div>

      <div
        ref={fgRef}
        className="swipe-fg item"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        <div className="item-main">
          <span className="item-name">{it.name}</span>
          {it.addedBy && (
            <span className="item-meta">
              <Avatar name={it.addedBy.display_name} color={it.addedBy.color} size={16} />
              {it.addedBy.display_name}
            </span>
          )}
        </div>
        {it.quantity && <span className="qty-badge">{it.quantity}</span>}
      </div>
    </li>
  )
}

export default function ShoppingList({ items, onAdd, onDelete }) {
  const { t } = useLang()
  const [name, setName] = useState('')
  const [qty, setQty] = useState('')

  // FLIP : quand un article arrive en haut, les autres glissent vers le bas.
  const listRef = useRef(null)
  const prevTops = useRef(new Map())
  useLayoutEffect(() => {
    const ul = listRef.current
    if (!ul) {
      prevTops.current = new Map()
      return
    }
    const nodes = ul.querySelectorAll('[data-flip-id]')
    const next = new Map()
    nodes.forEach((n) => next.set(n.dataset.flipId, n.getBoundingClientRect().top))

    // Suppression en cours : le repli (collapseRow) anime déjà la sortie et le
    // resserrement des voisines. On saute le FLIP pour ne pas les animer 2 fois.
    let removed = false
    prevTops.current.forEach((_, id) => { if (!next.has(id)) removed = true })
    if (removed) {
      prevTops.current = next
      return
    }

    nodes.forEach((n) => {
      const id = n.dataset.flipId
      const prev = prevTops.current.get(id)
      const now = next.get(id)
      if (prev != null && prev !== now) {
        n.animate(
          [{ transform: `translateY(${prev - now}px)` }, { transform: 'translateY(0)' }],
          { duration: 340, easing: 'cubic-bezier(0.34, 1.3, 0.4, 1)' }
        )
      }
    })
    prevTops.current = next
  }, [items])

  function submitAdd(e) {
    e.preventDefault()
    const n = name.trim()
    if (!n) return
    onAdd(n, qty)
    setName('')
    setQty('')
  }

  return (
    <div className="list-view">
      <form className="add-bar" onSubmit={submitAdd}>
        <input
          className="add-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('add_item_ph')}
          aria-label={t('aria_item_name')}
          maxLength={60}
        />
        <input
          className="add-qty"
          inputMode="numeric"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          placeholder={t('qty_ph')}
          aria-label={t('aria_qty')}
          maxLength={12}
        />
        <button type="submit" className="add-btn" aria-label={t('aria_add')} disabled={!name.trim()}>
          <Icon name="plus" size={22} strokeWidth={2.4} />
        </button>
      </form>

      {items.length === 0 ? (
        <div className="empty">
          <span className="empty-icon">
            <Icon name="list" size={30} />
          </span>
          <p className="empty-title">{t('empty_title')}</p>
          <p className="muted">{t('empty_body')}</p>
        </div>
      ) : (
        <ul className="items" ref={listRef}>
          {items.map((it) => (
            <SwipeRow key={it.id} it={it} onDelete={onDelete} t={t} />
          ))}
        </ul>
      )}
    </div>
  )
}
