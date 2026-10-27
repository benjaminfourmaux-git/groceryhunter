import Icon from './Icon'
import Avatar from './Avatar'
import { useLang } from '../lib/i18n'

// L'inventaire du foyer : un produit distinct par ligne, rempli par les achats
// une heure après le passage en caisse. Il ne se vide plus tout seul — on y
// repioche, et on le nettoie à la main. L'avatar est celui du DERNIER acheteur.
// Lecture seule à ce stade : la sélection et ses deux actions viennent ensuite.
export default function History({ products, memberById }) {
  const { t } = useLang()

  if (!products || products.length === 0) {
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
    <ul className="hist-list">
      {products.map((p) => {
        const buyer = memberById[p.last_bought_by]
        return (
          <li key={p.id} className="hist-item">
            {buyer && <Avatar name={buyer.display_name} color={buyer.color} size={24} />}
            <span className="item-name">{p.name}</span>
          </li>
        )
      })}
    </ul>
  )
}
