import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import Icon from './Icon'
import Avatar from './Avatar'
import CheckDot from './CheckDot'
import usePresenceItems from '../lib/usePresenceItems'
import { collapseRow, resetRow } from '../lib/swipeExit'
import { orderProducts, SORT_ALPHA, SORT_RANK } from '../lib/inventory'
import { EASE, useReducedMotion } from '../lib/motion'
import { useLang } from '../lib/i18n'

// Le rangement doit se lire comme un déplacement, pas comme un rafraîchissement.
// Le produit coché est « porté » : il se soulève, traverse la liste au-dessus
// des autres et se repose en tête — d'autant plus longtemps qu'il vient de loin.
// Les voisins glissent pour lui faire place, en vague depuis l'endroit qu'il a
// quitté : les plus proches bougent d'abord.
const CARRY = { base: 380, perPx: 0.4, max: 680 } // trajet du produit coché
const SLIDE = { base: 300, perPx: 0.3, max: 520 } // glissé des voisins
const RIPPLE_MS = 22 // décalage d'un voisin au suivant
const RIPPLE_MAX_MS = 132
const LIFT_SCALE = 1.03
const SETTLE = 'cubic-bezier(0.45, 0, 0.55, 1)' // montée et pose de l'échelle

const durationFor = ({ base, perPx, max }, distance) => Math.min(max, base + distance * perPx)

// Décalage vertical en cours d'une ligne déjà en mouvement (FLIP interrompu).
function currentShift(node) {
  const transform = getComputedStyle(node).transform
  return transform && transform !== 'none' ? new DOMMatrixReadOnly(transform).m42 : 0
}

function useReorderMotion(listRef, orderKey, selected, active) {
  const reduced = useReducedMotion()
  const prevTops = useRef(new Map())
  const prevSelected = useRef(selected)
  const motions = useRef(new Map())

  function stop(id) {
    const motion = motions.current.get(id)
    if (!motion) return
    motion.animations.forEach((animation) => {
      animation.onfinish = null
      animation.cancel()
    })
    motion.node.removeAttribute('data-sorting')
    motions.current.delete(id)
  }

  useLayoutEffect(() => {
    const ul = listRef.current
    const nodes = ul ? [...ul.querySelectorAll('[data-flip-id]')] : []
    const next = new Map(nodes.map((n) => [n.dataset.flipId, n.offsetTop]))

    // Chaque ligne repart de l'endroit où on la VOIT : un rangement lancé
    // pendant un autre enchaîne sans saut.
    const shifts = new Map()
    nodes.forEach((n) => {
      const id = n.dataset.flipId
      const prev = prevTops.current.get(id)
      if (prev == null) return
      const inFlight = motions.current.has(id) ? currentShift(n) : 0
      shifts.set(id, prev + inFlight - next.get(id))
    })

    // React range en DÉPLAÇANT des nœuds dans le DOM, et un nœud déplacé
    // relance son animation CSS d'entrée : c'est ce qui donnait l'impression
    // que les lignes réapparaissaient. Une ligne déjà là ne la rejoue plus.
    nodes.forEach((n) => {
      if (prevTops.current.has(n.dataset.flipId)) n.setAttribute('data-arrived', '')
    })
    ;[...motions.current.keys()].forEach(stop)

    // Suppression en cours : collapseRow anime déjà la sortie.
    const removed = [...prevTops.current.keys()].some((id) => !next.has(id))
    const canAnimate = active && !reduced && !removed && !ul?.querySelector('[data-exiting]')
    if (canAnimate) {
      const toggled = new Set(
        nodes
          .map((n) => n.dataset.flipId)
          .filter((id) => selected.has(id) !== prevSelected.current.has(id) && Math.abs(shifts.get(id) ?? 0) >= 0.5)
      )
      // Origine de la vague : la place que le produit coché vient de quitter
      // (s'il y en a plusieurs, celui qui fait le plus long trajet).
      const carriedId = [...toggled].sort((a, b) => Math.abs(shifts.get(b)) - Math.abs(shifts.get(a)))[0]
      const origin = carriedId != null ? prevTops.current.get(carriedId) : null
      const pitch = nodes.length > 1 ? Math.max(1, next.get(nodes[1].dataset.flipId) - next.get(nodes[0].dataset.flipId)) : 1

      nodes.forEach((n) => {
        const id = n.dataset.flipId
        const shift = shifts.get(id)
        if (shift == null || Math.abs(shift) < 0.5 || typeof n.animate !== 'function') return
        const carried = toggled.has(id)
        const distance = Math.abs(shift)
        let delay = 0
        if (!carried && origin != null) {
          const rows = Math.round(Math.abs(prevTops.current.get(id) - origin) / pitch)
          delay = Math.min(Math.max(rows - 1, 0) * RIPPLE_MS, RIPPLE_MAX_MS)
        }
        const duration = durationFor(carried ? CARRY : SLIDE, distance)
        n.setAttribute('data-sorting', carried ? 'carried' : '')
        const animations = [
          // fill « backwards » : un voisin en attente reste à sa place, il ne
          // saute pas à l'arrivée avant de partir.
          n.animate([{ transform: `translateY(${shift}px)` }, { transform: 'translateY(0)' }], {
            duration,
            delay,
            easing: EASE,
            fill: 'backwards',
          }),
        ]
        if (carried) {
          animations.push(
            n.animate(
              [
                { scale: '1', easing: SETTLE },
                { scale: String(LIFT_SCALE), offset: 0.28 },
                { scale: String(LIFT_SCALE), offset: 0.6, easing: SETTLE },
                { scale: '1' },
              ],
              { duration }
            )
          )
        }
        motions.current.set(id, { node: n, animations })
        animations[0].onfinish = () => stop(id)
      })
    }
    prevTops.current = next
    // La sélection de référence est celle du dernier RANGEMENT, pas du dernier
    // rendu : la nouvelle sélection arrive un rendu avant le nouvel ordre
    // (usePresenceItems), et le produit coché ne serait plus reconnu.
    prevSelected.current = selected
  }, [orderKey, reduced, active])

  useEffect(() => () => [...motions.current.keys()].forEach(stop), [])
}

// L'inventaire du foyer : un produit distinct par ligne, rempli par les achats
// une heure après le passage en caisse. Il ne se vide plus tout seul — on y
// repioche, et on le nettoie à la main.
//
// Les lignes sont celles de la liste, en plus fin et sans date, pour en montrer
// davantage. Cocher ici ne veut pas dire « acheté » mais « sélectionné » : les
// produits cochés remontent en tête, et deux boutons apparaissent dans le dock.
// L'avatar est celui du DERNIER acheteur.
export default function Inventory({
  products,
  memberById,
  selected,
  onToggleSelected,
  sort,
  onSortChange,
  active = true,
}) {
  const { t } = useLang()
  const ordered = useMemo(
    () => orderProducts(products, { selected, sort }),
    [products, selected, sort]
  )
  const present = usePresenceItems(ordered, active)
  const listRef = useRef(null)
  const orderKey = present.map(({ it }) => it.id).join('|')
  useReorderMotion(listRef, orderKey, selected, active)

  if (present.length === 0) {
    return (
      <div className="empty">
        <span className="empty-icon">
          <Icon name="inventory" size={30} />
        </span>
        <p className="empty-title">{t('inv_empty_title')}</p>
        <p className="muted">{t('inv_empty_body')}</p>
      </div>
    )
  }

  return (
    <div className="inv-view">
      {/* Deux tris : l'habitude du foyer, ou l'ordre alphabétique pour
          retrouver un produit précis. */}
      <div className="inv-sort" role="group" aria-label={t('inv_sort')}>
        <button
          type="button"
          className={sort === SORT_RANK ? 'on' : ''}
          aria-pressed={sort === SORT_RANK}
          onClick={() => onSortChange(SORT_RANK)}
        >
          {t('inv_sort_rank')}
        </button>
        <button
          type="button"
          className={sort === SORT_ALPHA ? 'on' : ''}
          aria-pressed={sort === SORT_ALPHA}
          onClick={() => onSortChange(SORT_ALPHA)}
        >
          {t('inv_sort_alpha')}
        </button>
      </div>

      <ul className="inv-list" ref={listRef}>
        {present.map(({ it: p, exiting }) => {
          const buyer = memberById[p.last_bought_by]
          const isOn = selected.has(p.id)
          return (
            <InventoryRow key={p.id} id={p.id} exiting={exiting} selected={isOn}>
              {buyer && <Avatar name={buyer.display_name} color={buyer.color} size={24} />}
              <span className="item-name">{p.name}</span>
              <CheckDot
                checked={isOn}
                onToggle={() => onToggleSelected(p.id)}
                label={isOn ? t('aria_deselect') : t('aria_select')}
              />
            </InventoryRow>
          )
        })}
      </ul>
    </div>
  )
}

// Même sortie que dans la liste : la place se replie au lieu de disparaître
// d'un coup sous le doigt.
function InventoryRow({ id, exiting, selected, children }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    if (exiting) return collapseRow(ref.current)
    resetRow(ref.current)
  }, [exiting])
  return (
    <li
      ref={ref}
      data-flip-id={id}
      className={'inv-item' + (selected ? ' selected' : '')}
      data-exiting={exiting || undefined}
      inert={exiting ? '' : undefined}
    >
      {children}
    </li>
  )
}
