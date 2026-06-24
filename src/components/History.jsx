import { useRef, useState } from 'react'
import Icon from './Icon'
import Avatar from './Avatar'
import { hashColor } from '../lib/colors'
import { useLang, useCurrency } from '../lib/i18n'
import { formatPrice, parsePrice, sanitizePriceInput } from '../lib/price'
import { collapseRow, resetRow } from '../lib/swipeExit'

const TRIP_COMMIT_RATIO = 0.6 // suppression à 60 % de la largeur (pas d'inertie)

// Swipe-to-delete pour une sortie d'historique. Même geste que la liste, mais
// SANS inertie : seule la distance décide (au-delà de 80 %, on supprime). Ignore
// les zones interactives (bouton prix, champ) pour ne pas gêner l'édition.
function SwipeTrip({ trip, onDelete, editing, t, children }) {
  const rowRef = useRef(null)
  const fgRef = useRef(null)
  const drag = useRef(null)
  const removing = useRef(false)

  function down(e) {
    if (removing.current || editing) return
    if (e.target.closest('.price-edit, .price-input')) return // laisse le clic/saisie
    drag.current = {
      startX: e.clientX,
      startY: e.clientY,
      width: rowRef.current.clientWidth,
      axis: null, // null = indécis, 'h' = horizontal, 'v' = scroll vertical
      pid: e.pointerId,
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

    const x = Math.max(-d.width, Math.min(0, dx)) // gauche uniquement
    fgRef.current.style.transform = `translateX(${x}px)`
    rowRef.current.toggleAttribute('data-armed', -x >= d.width * TRIP_COMMIT_RATIO)
  }

  function up(e) {
    const d = drag.current
    if (!d || e.pointerId !== d.pid) return
    drag.current = null

    const fg = fgRef.current
    const row = rowRef.current
    fg.style.transition = '' // ré-active le ressort CSS
    const armed = row.hasAttribute('data-armed')

    if (d.axis === 'h' && armed) {
      removing.current = true
      fg.style.transform = `translateX(-${d.width}px)`
      let called = false
      const finish = async () => {
        if (called) return
        called = true
        fg.removeEventListener('transitionend', finish)
        try {
          await new Promise((res) => collapseRow(row, res)) // repli fluide
          await onDelete(trip.id) // succès → le composant est démonté
        } catch {
          // Échec (ex. RLS) : on annule tout au lieu de laisser la ligne repliée.
          removing.current = false
          resetRow(row, fg)
        }
      }
      fg.addEventListener('transitionend', finish)
      setTimeout(finish, 400) // filet de sécurité
    } else {
      fg.style.transform = ''
      row.removeAttribute('data-armed')
    }
  }

  return (
    <li ref={rowRef} className="swipe-row">
      <div className="swipe-bg">
        <button
          type="button"
          className="swipe-delete"
          onClick={() => onDelete(trip.id)}
          aria-label={t('aria_delete')}
        >
          <span className="swipe-bg-icon">
            <Icon name="trash" size={20} />
          </span>
        </button>
      </div>

      <div
        ref={fgRef}
        className="swipe-fg trip"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        {children}
      </div>
    </li>
  )
}

function formatDate(iso, t, locale) {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday = d.toDateString() === yesterday.toDateString()

  const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  if (sameDay) return t('today_at', { time })
  if (isYesterday) return t('yesterday_at', { time })
  return d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' }) + ` · ${time}`
}

export default function History({ trips, onUpdatePrice, onDelete, colorByName }) {
  const { t, locale } = useLang()
  const { currency, currencySymbol } = useCurrency()
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState('')

  function startEdit(trip) {
    setDraft(trip.price != null ? String(trip.price).replace('.', ',') : '')
    setEditingId(trip.id)
  }
  function savePrice(trip) {
    setEditingId(null)
    const parsed = parsePrice(draft)
    if (parsed === (trip.price ?? null)) return
    onUpdatePrice?.(trip.id, parsed)
  }

  if (trips.length === 0) {
    return (
      <div className="empty">
        <span className="empty-icon">
          <Icon name="history" size={30} />
        </span>
        <p className="empty-title">{t('hist_empty_title')}</p>
        <p className="muted">{t('hist_empty_body')}</p>
      </div>
    )
  }

  return (
    <ul className="trips">
      {trips.map((trip) => {
        const editing = editingId === trip.id
        return (
          <SwipeTrip key={trip.id} trip={trip} onDelete={onDelete} editing={editing} t={t}>
            <div className="trip-head">
              <Avatar
                name={trip.shopper_name}
                color={colorByName?.[trip.shopper_name] ?? hashColor(trip.shopper_name)}
                size={34}
              />
              <div className="trip-head-text">
                <span className="trip-shopper">{trip.shopper_name}</span>
                <span className="muted small">{formatDate(trip.created_at, t, locale)}</span>
              </div>
              <div className="trip-right">
                {editing ? (
                  <span className="price-input-wrap editing">
                    <input
                      className="price-input"
                      inputMode="decimal"
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(sanitizePriceInput(e.target.value))}
                      onBlur={() => savePrice(trip)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur()
                      }}
                      placeholder={t('price_ph')}
                      maxLength={10}
                    />
                    <span className="price-cur">{currencySymbol}</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="price-edit"
                    onClick={() => startEdit(trip)}
                    aria-label={t('edit_price')}
                    title={t('edit_price')}
                  >
                    <span className="trip-price">{formatPrice(trip.price, locale, currency) ?? '—'}</span>
                    <Icon name="pencil" size={12} />
                  </button>
                )}
                <span className="trip-count">{t('items_count', { n: trip.item_count })}</span>
              </div>
            </div>

            {Array.isArray(trip.items) && trip.items.length > 0 && (
              <div className="trip-items">
                {trip.items.map((label, i) => (
                  <span key={i} className="trip-chip">
                    {label}
                  </span>
                ))}
              </div>
            )}
          </SwipeTrip>
        )
      })}
    </ul>
  )
}
