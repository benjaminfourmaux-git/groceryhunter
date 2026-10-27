import { useMemo } from 'react'
import Icon from './Icon'
import Avatar from './Avatar'
import CheckDot from './CheckDot'
import { orderProducts, SORT_ALPHA, SORT_RANK } from '../lib/inventory'
import { useLang } from '../lib/i18n'

// L'inventaire du foyer : un produit distinct par ligne, rempli par les achats
// une heure après le passage en caisse. Il ne se vide plus tout seul — on y
// repioche, et on le nettoie à la main.
//
// Les lignes sont celles de la liste (.item), en plus fin, sans date. Cocher
// ici ne veut pas dire « acheté » mais « sélectionné » : les produits cochés
// remontent en tête, et deux boutons apparaissent dans le dock. L'avatar est
// celui du DERNIER acheteur.
export default function Inventory({
  products,
  memberById,
  selected,
  onToggleSelected,
  sort,
  onSortChange,
}) {
  const { t } = useLang()
  const ordered = useMemo(() => orderProducts(products, { selected, sort }), [products, selected, sort])

  if (ordered.length === 0) {
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
    <>
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

      <ul className="inv-list">
      {ordered.map((p) => {
        const buyer = memberById[p.last_bought_by]
        const isOn = selected.has(p.id)
        return (
          <li key={p.id} className={'item compact' + (isOn ? ' selected' : '')}>
            <div className="item-main">
              {buyer && <Avatar name={buyer.display_name} color={buyer.color} size={20} />}
              <span className="item-name">{p.name}</span>
            </div>
            <CheckDot
              checked={isOn}
              tone="brand"
              onToggle={() => onToggleSelected(p.id)}
              label={isOn ? t('aria_deselect') : t('aria_select')}
            />
          </li>
        )
      })}
      </ul>
    </>
  )
}
