import { useLayoutEffect, useRef, useState } from 'react'
import Icon from './Icon'
import Avatar from './Avatar'
import { useLang } from '../lib/i18n'

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
            <li key={it.id} data-flip-id={it.id} className="item">
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

              <button
                type="button"
                className="icon-btn ghost danger"
                onClick={() => onDelete(it.id)}
                aria-label={t('aria_delete')}
              >
                <Icon name="trash" size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
