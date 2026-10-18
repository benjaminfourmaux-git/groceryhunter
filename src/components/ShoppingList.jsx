import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Icon from './Icon'
import Avatar from './Avatar'
import { useLang } from '../lib/i18n'
import { collapseRow, resetRow } from '../lib/swipeExit'
import { T1_MS } from '../lib/config'
import { reducedMotion } from '../lib/motion'
import usePresenceItems from '../lib/usePresenceItems'

const COMMIT_RATIO = 0.4 // fraction de la largeur de ligne à atteindre pour supprimer
const FLICK_VELOCITY = 1.2 // px/ms vers la gauche : un geste vif supprime même court
const FLICK_MIN_DX = 24 // mais il faut un déplacement minimal, pour éviter le faux geste
const SWIPE_COLLAPSE = { height: 400, opacity: 300 } // repli lent après un glissé de suppression

const RING_R = 15 // anneau de 32 px autour du rond de 24 px (maquette « Grand ciel »)
const RING_CIRC = 2 * Math.PI * RING_R // circonférence de l'anneau de compte à rebours

// Case à cocher « acheté » (à droite). Vide = à acheter ; cochée = rouge + anneau
// qui se vide sur la durée T1 (le temps restant avant de filer dans l'historique).
// Tap uniquement : dès que le doigt bouge, l'appui est annulé (le rond se
// relâche et rien n'est coché). Glisser depuis la case ne fait rien.
const TAP_SLOP = 6 // px tolérés avant d'annuler l'appui
// Pas de pause avant le rangement : l'article descend dès le tap (une pause,
// même courte, se ressentait comme un délai entre le clic et le déplacement).
const CONFIRM_MS = 0
const MOVE_MS = 250

function BuyCheck({ bought, fraction, onToggle, t }) {
  const press = useRef(null)
  const [pressed, setPressed] = useState(false)

  // Petite éclosion locale, sans particule qui tombe hors de la carte.
  // Rien au premier affichage d'un article déjà coché.
  const [petal, setPetal] = useState(0)
  const petalSequence = useRef(0)
  const wasBought = useRef(bought)
  useEffect(() => {
    if (bought && !wasBought.current) setPetal(++petalSequence.current)
    if (!bought) setPetal(0)
    wasBought.current = bought
  }, [bought])

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
    if (Math.abs(e.clientX - p.x) > TAP_SLOP || Math.abs(e.clientY - p.y) > TAP_SLOP) {
      press.current = null
    } else {
      p.released = true
    }
    setPressed(false)
  }
  function cancel(e) {
    if (press.current && e.pointerId !== press.current.pid) return
    press.current = null
    setPressed(false)
  }
  function onPointerLeave(e) {
    // Au toucher, pointerout/leave peut précéder le clic après pointerup.
    // Le doigt a déjà été relevé : ce n'est plus un glissement à annuler.
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
      className={'buy-check' + (bought ? ' bought' : '') + (pressed ? ' pressed' : '')}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={cancel}
      onPointerLeave={onPointerLeave}
      onClick={onClick}
      aria-label={bought ? t('aria_uncheck') : t('aria_check')}
      aria-pressed={bought}
    >
      {bought && (
        <svg className="buy-ring" viewBox="0 0 32 32" aria-hidden="true">
          <circle className="buy-ring-track" cx="16" cy="16" r={RING_R} />
          <circle
            className="buy-ring-fill"
            cx="16"
            cy="16"
            r={RING_R}
            strokeDasharray={RING_CIRC}
            strokeDashoffset={RING_CIRC * (1 - fraction)}
          />
        </svg>
      )}
      <span className="buy-dot" aria-hidden="true">
        {bought && (
          <svg className="buy-tick" width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 12 5 5 9-10" pathLength="1" />
          </svg>
        )}
      </span>
      {petal > 0 && (
        <span key={petal} className="petal-bloom" aria-hidden="true"
          onAnimationEnd={() => setPetal((current) => current === petal ? 0 : current)}>
          <i /><i /><i />
        </span>
      )}
    </button>
  )
}

// « il y a 12 min » : un article coché reste au plus T1 (1 h) dans la liste,
// les minutes suffisent.
function agoLabel(ms, t) {
  const n = Math.floor(ms / 60000)
  return n < 1 ? t('just_now') : t('ago_min', { n })
}

function ListSeparator({ exiting, children }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    if (exiting) return collapseRow(ref.current)
    resetRow(ref.current)
  }, [exiting])
  return <li ref={ref} data-flip-id="separator" className="list-sep" aria-hidden="true"><span>{children}</span></li>
}

// Chaque ligne gère son propre swipe (suppression). Glisser au-delà du seuil =
// suppression ; en deçà, la ligne revient. Un tap sur la case coche l'article.
function SwipeRow({ it, displayBoughtAt, now, adder, onToggleBought, onDelete, exiting, t }) {
  const rowRef = useRef(null)
  const fgRef = useRef(null)
  const drag = useRef(null)
  const removing = useRef(false)
  const wasExiting = useRef(false)

  useLayoutEffect(() => {
    const row = rowRef.current
    if (exiting) {
      cancel()
      wasExiting.current = true
      removing.current = true
      return collapseRow(row)
    }
    if (wasExiting.current) {
      wasExiting.current = false
      removing.current = false
      resetRow(row, fgRef.current)
    }
  }, [exiting])

  const bought = !!it.bought_at
  const boughtMs = bought ? Date.parse(it.bought_at) : 0
  const fraction = bought ? Math.max(0, Math.min(1, (T1_MS - (now - boughtMs)) / T1_MS)) : 0

  function down(e) {
    if (!e.isPrimary || e.button !== 0 || drag.current) return
    if (removing.current) return
    if (e.target.closest('.buy-check')) return // la case ne lance jamais de glissé
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
    const interrupt = () => cancel()
    const visibility = () => { if (document.hidden) cancel() }
    window.addEventListener('blur', interrupt)
    document.addEventListener('visibilitychange', visibility)
    drag.current.cleanup = () => {
      window.removeEventListener('blur', interrupt)
      document.removeEventListener('visibilitychange', visibility)
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
    d.cleanup?.()
    drag.current = null

    const fg = fgRef.current
    const row = rowRef.current
    fg.style.transition = ''

    const flicked = e.timeStamp - d.lastT < 100 && d.vx <= -FLICK_VELOCITY && -d.x >= FLICK_MIN_DX
    const commit = d.axis === 'h' && (row.hasAttribute('data-armed') || flicked)

    if (commit) {
      removing.current = true
      // L'article finit de glisser à la vitesse du geste : toute la bande
      // devient rouge, PUIS l'article est supprimé et la ligne se replie.
      const speed = Math.max(Math.abs(d.vx), 0.3)
      const dur = reducedMotion() ? 0 : Math.min(360, Math.max(120, (d.width + d.x) / speed))
      fg.style.transition = `transform ${Math.round(dur)}ms cubic-bezier(0.22, 1, 0.36, 1)`
      fg.style.transform = `translateX(-${d.width}px)`
      let called = false
      const remove = (e) => {
        if (e && (e.target !== fg || e.propertyName !== 'transform')) return
        if (called) return
        called = true
        fg.removeEventListener('transitionend', remove)
        // Sans pause : la bande rouge se replie aussitôt, lentement, dans la
        // continuité du geste ; l'article est supprimé une fois replié.
        const del = () => Promise.resolve(onDelete(it.id)).catch(() => {
          removing.current = false
          resetRow(row, fg)
        })
        if (dur === 0) del()
        else collapseRow(row, del, SWIPE_COLLAPSE)
      }
      if (dur === 0) remove()
      else {
        fg.addEventListener('transitionend', remove)
        setTimeout(remove, dur + 80) // filet si transitionend ne tire pas
      }
    } else {
      fg.style.transform = ''
      row.removeAttribute('data-armed')
    }
  }

  function cancel(e) {
    const d = drag.current
    if (!d || (e?.pointerId != null && e.pointerId !== d.pid)) return
    d.cleanup?.()
    drag.current = null
    fgRef.current.style.transition = ''
    fgRef.current.style.transform = ''
    rowRef.current.removeAttribute('data-armed')
  }
  useEffect(() => () => drag.current?.cleanup?.(), [])

  return (
    <li ref={rowRef} data-flip-id={it.id} data-exiting={exiting || undefined}
      inert={exiting ? '' : undefined} className={'swipe-row' + (bought ? ' bought' : '')}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget && e.animationName === 'item-in') {
          e.currentTarget.setAttribute('data-arrived', '')
        }
      }}>
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
        onPointerCancel={cancel}
        onLostPointerCapture={cancel}
      >
        <div className="item-main">
          {adder && <Avatar name={adder.display_name} color={adder.color} size={32} />}
          <span className="item-name">{it.name}</span>
        </div>
        {it.quantity && <span className="qty-badge">{it.quantity}</span>}
        {/* Le libellé change la largeur disponible pour le nom : il apparaît
            avec le rangement, pour ne pas déplacer les voisins une première fois. */}
        {displayBoughtAt && <span className="item-when">{agoLabel(now - Date.parse(displayBoughtAt), t)}</span>}
        <BuyCheck
          bought={bought}
          fraction={fraction}
          onToggle={() => onToggleBought(it.id, !bought)}
          t={t}
        />
      </div>
    </li>
  )
}

export default function ShoppingList({ items, now, memberById, onToggleBought, onDelete, active = true }) {
  const { t } = useLang()
  const present = usePresenceItems(items, active)
  // Seule la liste visible fait vivre l'anneau chaque seconde. Le reste de
  // l'application se réveille aux échéances T1/T2, sans retrier à chaque tick.
  const [ringNow, setRingNow] = useState(now)
  const hasBought = items.some((it) => !!it.bought_at)
  useEffect(() => {
    if (!active || !hasBought) return
    let interval
    function sync() {
      clearInterval(interval)
      if (document.hidden) return
      setRingNow(Date.now())
      interval = setInterval(() => setRingNow(Date.now()), 1000)
    }
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [active, hasBought])
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
  // Seul le rangement attend 120 ms. La coche et la requête partent tout de
  // suite ; on conserve temporairement l'ancienne position de chaque article.
  const holds = useRef(new Map())
  const [heldPositions, setHeldPositions] = useState(new Map())
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    function change() {
      setReducedMotion(media.matches)
      if (media.matches) {
        holds.current.forEach(({ timer }) => clearTimeout(timer))
        holds.current.clear()
        setHeldPositions(new Map())
      }
    }
    change()
    media.addEventListener('change', change)
    return () => {
      media.removeEventListener('change', change)
      holds.current.forEach(({ timer }) => clearTimeout(timer))
      holds.current.clear()
    }
  }, [])

  function toggleBought(id, bought) {
    const it = items.find((item) => item.id === id)
    if (!it) return
    const held = holds.current.get(id)
    if (held) clearTimeout(held.timer)
    const boughtAt = held ? held.boughtAt : it.bought_at
    holds.current.delete(id)
    // Une seconde pression avant le rangement annule simplement celui-ci.
    if (CONFIRM_MS > 0 && !reducedMotion && !!boughtAt !== bought) {
      const timer = setTimeout(() => {
        holds.current.delete(id)
        setHeldPositions(new Map(holds.current))
      }, CONFIRM_MS)
      holds.current.set(id, { boughtAt, timer })
    }
    setHeldPositions(new Map(holds.current))
    onToggleBought(id, bought)
  }

  const presented = present.map(({ it, exiting }) => ({
    it,
    exiting,
    boughtAt: heldPositions.has(it.id) ? heldPositions.get(it.id).boughtAt : it.bought_at,
  }))
  if (heldPositions.size) {
    presented.sort((a, b) => {
      if (!!a.boughtAt !== !!b.boughtAt) return a.boughtAt ? 1 : -1
      return a.boughtAt
        ? Date.parse(a.boughtAt) - Date.parse(b.boughtAt)
        : Date.parse(b.it.created_at) - Date.parse(a.it.created_at)
    })
  }

  // FLIP : article et voisins glissent ensemble, sans rebond ni auto-scroll.
  // Le séparateur participe au mouvement, même si une seule ligne est présente.
  // Un nouveau rangement reprend la position VISUELLE de l'animation précédente.
  const listRef = useRef(null)
  const prevTops = useRef(new Map())
  const motions = useRef(new Map())
  const orderKey = presented.map(({ it, boughtAt }) => `${it.id}:${!!boughtAt}`).join('|')
  useLayoutEffect(() => {
    const ul = listRef.current
    const nodes = ul ? [...ul.querySelectorAll('[data-flip-id]')] : []
    const next = new Map()
    nodes.forEach((n) => next.set(n.dataset.flipId, n.offsetTop))
    const shifts = new Map()
    nodes.forEach((n) => {
      const id = n.dataset.flipId
      const prev = prevTops.current.get(id)
      const offset = motions.current.has(id)
        ? new DOMMatrixReadOnly(getComputedStyle(n).transform).m42
        : 0
      if (prev != null) shifts.set(id, prev + offset - next.get(id))
    })
    // Safari peut relancer une animation CSS lorsqu'un même nœud est déplacé
    // dans le DOM. Une carte déjà présente ne doit plus rejouer son entrée :
    // seul le FLIP pilote son déplacement, y compris avant la fin de l'entrée.
    nodes.forEach((n) => {
      if (prevTops.current.has(n.dataset.flipId) && n.classList.contains('swipe-row')) {
        n.setAttribute('data-arrived', '')
      }
    })
    motions.current.forEach(({ animation, node }) => {
      animation.onfinish = null
      animation.cancel()
      node.removeAttribute('data-sorting')
    })
    motions.current.clear()

    // Suppression en cours : collapseRow anime déjà la sortie → on saute le FLIP.
    const removed = [...prevTops.current.keys()].some((id) => id !== 'separator' && !next.has(id))
    if (active && !reducedMotion && !removed && !ul?.querySelector('[data-exiting]')) {
      nodes.forEach((n) => {
        const id = n.dataset.flipId
        const shift = shifts.get(id)
        if (shift == null || Math.abs(shift) < 0.5) return
        n.setAttribute('data-sorting', '')
        const animation = n.animate(
          [{ transform: `translateY(${shift}px)` }, { transform: 'translateY(0)' }],
          { duration: MOVE_MS, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
        )
        motions.current.set(id, { animation, node: n })
        animation.onfinish = () => {
          motions.current.delete(id)
          n.removeAttribute('data-sorting')
          animation.cancel()
        }
      })
    }
    prevTops.current = next
  }, [orderKey, reducedMotion, active])

  useEffect(() => () => {
    motions.current.forEach(({ animation }) => {
      animation.onfinish = null
      animation.cancel()
    })
    motions.current.clear()
  }, [])

  if (presented.length === 0) {
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
        {presented.flatMap(({ it, boughtAt, exiting }, i) => {
          // Séparateur « En partance » avant le premier article coché.
          // flatMap (liste PLATE de frères à clé) : un tableau par article
          // ferait réconcilier React par position, et chaque coche recréerait
          // toutes les lignes (animation d'entrée rejouée, pétale perdu).
          const firstBought = boughtAt && (i === 0 || !presented[i - 1].boughtAt)
          return [
            firstBought && (
              <ListSeparator key="sep" exiting={presented.every((entry) => !entry.boughtAt || entry.exiting)}>
                {t('leaving_soon')}
              </ListSeparator>
            ),
            <SwipeRow
              key={it.id}
              it={it}
              displayBoughtAt={boughtAt}
              now={Math.max(now, ringNow)}
              exiting={exiting}
              adder={memberById[it.added_by]}
              onToggleBought={toggleBought}
              onDelete={onDelete}
              t={t}
            />,
          ]
        })}
      </ul>
    </div>
  )
}
