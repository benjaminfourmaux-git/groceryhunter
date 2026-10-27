import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Icon from './Icon'
import Avatar from './Avatar'
import CheckDot from './CheckDot'
import { useLang } from '../lib/i18n'
import { collapseRow, resetRow } from '../lib/swipeExit'
import { T1_MS } from '../lib/config'

const COMMIT_RATIO = 0.4 // fraction de la largeur de ligne à atteindre pour supprimer
const FLICK_VELOCITY = 1.2 // px/ms vers la gauche : un geste vif supprime même court
const FLICK_MIN_DX = 24 // mais il faut un déplacement minimal, pour éviter le faux geste

// Chaque ligne gère son propre swipe (suppression). Glisser au-delà du seuil =
// suppression ; en deçà, la ligne revient. Un tap sur la case coche l'article.
function SwipeRow({ it, now, adder, onToggleBought, onDelete, onSetQuantity, t }) {
  const rowRef = useRef(null)
  const fgRef = useRef(null)
  const drag = useRef(null)
  const removing = useRef(false)
  const qtyRef = useRef(null)
  const [editing, setEditing] = useState(false)

  // Le champ s'ouvre déjà rempli et sélectionné : on remplace une quantité plus
  // souvent qu'on ne la complète.
  useEffect(() => {
    if (!editing) return
    const el = qtyRef.current
    if (!el) return
    el.focus()
    el.select()
  }, [editing])

  function commitQuantity() {
    if (!editing) return
    const value = qtyRef.current?.value ?? ''
    setEditing(false)
    onSetQuantity(it.id, value)
  }

  const bought = !!it.bought_at
  const boughtMs = bought ? Date.parse(it.bought_at) : 0
  const fraction = bought ? Math.max(0, Math.min(1, (T1_MS - (now - boughtMs)) / T1_MS)) : 0

  function down(e) {
    if (removing.current) return
    // Ni la case, ni le nom, ni le champ de quantité ne lancent de glissé.
    if (e.target.closest('.buy-check, .item-name-btn, .qty-edit, .qty-badge')) return
    drag.current = {
      startX: e.clientX,
      startY: e.clientY,
      width: rowRef.current.clientWidth,
      axis: null,
      pid: e.pointerId,
      x: 0,
      lastX: e.clientX,
      lastT: e.timeStamp,
      vx: 0,
    }
    fgRef.current.style.transition = 'none'
    try { fgRef.current.setPointerCapture(e.pointerId) } catch { /* noop */ }
  }

  function move(e) {
    const d = drag.current
    if (!d || e.pointerId !== d.pid) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (d.axis === null && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
      d.axis = Math.abs(dy) > Math.abs(dx) ? 'v' : 'h'
    }
    if (d.axis !== 'h') return

    const dt = e.timeStamp - d.lastT
    if (dt > 0) {
      const inst = (e.clientX - d.lastX) / dt
      d.vx = d.vx * 0.4 + inst * 0.6
      d.lastX = e.clientX
      d.lastT = e.timeStamp
    }

    const x = Math.max(-d.width, Math.min(0, dx))
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
    fg.style.transition = ''

    const flicked = d.vx <= -FLICK_VELOCITY && -d.x >= FLICK_MIN_DX
    const commit = d.axis === 'h' && (row.hasAttribute('data-armed') || flicked)

    if (commit) {
      removing.current = true
      const speed = Math.max(Math.abs(d.vx), 0.3)
      const remaining = d.width + d.x
      const dur = Math.min(360, Math.max(120, remaining / speed))
      fg.style.transition = `transform ${Math.round(dur)}ms cubic-bezier(0.22, 1, 0.36, 1)`
      fg.style.transform = `translateX(-${d.width}px)`
      let called = false
      const finish = async () => {
        if (called) return
        called = true
        fg.removeEventListener('transitionend', finish)
        try {
          await new Promise((res) => collapseRow(row, res))
          await onDelete(it.id)
        } catch {
          removing.current = false
          resetRow(row, fg)
        }
      }
      fg.addEventListener('transitionend', finish)
      setTimeout(finish, 400)
    } else {
      fg.style.transform = ''
      row.removeAttribute('data-armed')
    }
  }

  return (
    <li ref={rowRef} data-flip-id={it.id} className="swipe-row">
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
        className={'swipe-fg item' + (bought ? ' bought' : '')}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        <div className="item-main">
          {adder && <Avatar name={adder.display_name} color={adder.color} size={24} />}
          {/* Le nom ouvre l'édition de la quantité : les articles venus de
              l'inventaire arrivent sans quantité, donc sans pastille à viser.
              Un article déjà acheté n'est plus modifiable — il est en partance. */}
          <button
            type="button"
            className="item-name-btn"
            onClick={() => setEditing(true)}
            disabled={bought}
            aria-label={t('aria_edit_qty', { name: it.name })}
          >
            <span className="item-name">{it.name}</span>
          </button>
        </div>
        {editing ? (
          <form
            className="qty-edit"
            onSubmit={(e) => {
              e.preventDefault()
              commitQuantity()
            }}
          >
            <input
              ref={qtyRef}
              type="text"
              defaultValue={it.quantity ?? ''}
              placeholder={t('qty_ph')}
              maxLength={12}
              aria-label={t('aria_qty')}
              onBlur={commitQuantity}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault()
                  setEditing(false) // annule : onBlur ne doit plus rien valider
                }
              }}
            />
          </form>
        ) : (
          it.quantity && (
            <button type="button" className="qty-badge" onClick={() => setEditing(true)}>
              {it.quantity}
            </button>
          )
        )}
        <CheckDot
          checked={bought}
          fraction={fraction}
          tone="danger"
          onToggle={() => onToggleBought(it.id, !bought)}
          label={bought ? t('aria_uncheck') : t('aria_check')}
        />
      </div>
    </li>
  )
}

export default function ShoppingList({
  items,
  now,
  memberById,
  onToggleBought,
  onDelete,
  onSetQuantity,
}) {
  const { t } = useLang()

  // FLIP : quand un article est acheté il descend en bas ; les autres glissent.
  // Ne se rejoue QUE si l'ordre change (pas à chaque tick du compte à rebours),
  // et mesure avec offsetTop : insensible aux animations en cours et au scroll,
  // sinon une mesure prise en plein glissement relançait une 2e animation.
  const listRef = useRef(null)
  const prevTops = useRef(new Map())
  const orderKey = items.map((it) => it.id).join('|')
  useLayoutEffect(() => {
    const ul = listRef.current
    if (!ul) {
      prevTops.current = new Map()
      return
    }
    const nodes = ul.querySelectorAll('[data-flip-id]')
    const next = new Map()
    nodes.forEach((n) => next.set(n.dataset.flipId, n.offsetTop))

    // Suppression en cours : collapseRow anime déjà la sortie → on saute le FLIP.
    let removed = false
    prevTops.current.forEach((_, id) => { if (!next.has(id)) removed = true })
    if (removed) {
      prevTops.current = next
      return
    }

    nodes.forEach((n) => {
      const id = n.dataset.flipId
      const prev = prevTops.current.get(id)
      const nowTop = next.get(id)
      if (prev != null && prev !== nowTop) {
        n.animate(
          [{ transform: `translateY(${prev - nowTop}px)` }, { transform: 'translateY(0)' }],
          { duration: 340, easing: 'cubic-bezier(0.34, 1.3, 0.4, 1)' }
        )
      }
    })
    prevTops.current = next
  }, [orderKey])

  if (items.length === 0) {
    return (
      <div className="list-view">
        <div className="empty">
          <span className="empty-icon">
            <Icon name="list" size={30} />
          </span>
          <p className="empty-title">{t('empty_title')}</p>
          <p className="muted">{t('empty_body')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="list-view">
      <ul className="items" ref={listRef}>
        {items.map((it) => (
          <SwipeRow
            key={it.id}
            it={it}
            now={now}
            adder={memberById[it.added_by]}
            onToggleBought={onToggleBought}
            onDelete={onDelete}
            onSetQuantity={onSetQuantity}
            t={t}
          />
        ))}
      </ul>
    </div>
  )
}
