import { useRef, useState } from 'react'
import Icon from './Icon'
import Avatar from './Avatar'
import { AVATAR_COLORS } from '../lib/colors'
import { useLang, useCurrency } from '../lib/i18n'
import { formatPrice, parsePrice, sanitizePriceInput } from '../lib/price'

const HOLD_MS = 600 // durée de l'appui long (= durée de l'effet de charge)

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

// Couleur stable à partir du nom (les membres ne sont pas joints ici).
function colorFor(name) {
  let h = 0
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export default function History({ trips, onUpdatePrice }) {
  const { t, locale } = useLang()
  const { currency, currencySymbol } = useCurrency()
  const [chargingId, setChargingId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState('')
  const holdRef = useRef(null)

  function startHold(trip) {
    if (editingId) return
    setChargingId(trip.id)
    holdRef.current = setTimeout(() => {
      setChargingId(null)
      setDraft(trip.price != null ? String(trip.price).replace('.', ',') : '')
      setEditingId(trip.id)
    }, HOLD_MS)
  }
  function cancelHold() {
    clearTimeout(holdRef.current)
    setChargingId(null)
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
          <li
            key={trip.id}
            className={'trip' + (chargingId === trip.id ? ' charging' : '')}
            onPointerDown={editing ? undefined : () => startHold(trip)}
            onPointerUp={cancelHold}
            onPointerLeave={cancelHold}
            onPointerCancel={cancelHold}
          >
            <div className="trip-head">
              <Avatar name={trip.shopper_name} color={colorFor(trip.shopper_name)} size={34} />
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
                  <span className="trip-price">{formatPrice(trip.price, locale, currency) ?? '—'}</span>
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
          </li>
        )
      })}
    </ul>
  )
}
