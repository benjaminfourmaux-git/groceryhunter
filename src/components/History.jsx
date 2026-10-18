import Icon from './Icon'
import Avatar from './Avatar'
import { useLang } from '../lib/i18n'
import { useLayoutEffect, useRef } from 'react'
import usePresenceItems from '../lib/usePresenceItems'
import { collapseRow, resetRow } from '../lib/swipeExit'

function formatWhen(iso, t, locale) {
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

// Historique = corbeille récente : les articles cochés « acheté » y restent un
// moment (T2) avant d'être supprimés définitivement. Lecture seule.
export default function History({ items, memberById, active = true }) {
  const { t, locale } = useLang()
  const present = usePresenceItems(items, active)

  if (present.length === 0) {
    return (
      <div className="empty">
        <span className="empty-icon">
          <Icon name="clock" size={30} />
        </span>
        <p className="empty-title">{t('hist_empty_title')}</p>
        <p className="muted">{t('hist_empty_body')}</p>
      </div>
    )
  }

  return (
    <ul className="hist-list">
      {present.map(({ it, exiting }) => {
        const buyer = memberById[it.bought_by]
        return (
          <HistoryRow key={it.id} exiting={exiting}>
            {buyer && <Avatar name={buyer.display_name} color={buyer.color} size={32} />}
            <span className="item-name">{it.name}</span>
            {it.quantity && <span className="qty-badge">{it.quantity}</span>}
            <span className="hist-when muted small">{formatWhen(it.bought_at, t, locale)}</span>
          </HistoryRow>
        )
      })}
    </ul>
  )
}

function HistoryRow({ exiting, children }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    if (exiting) return collapseRow(ref.current)
    resetRow(ref.current)
  }, [exiting])
  return <li ref={ref} className="hist-item" data-exiting={exiting || undefined}>{children}</li>
}
