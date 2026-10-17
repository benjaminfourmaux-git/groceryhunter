import Avatar from './Avatar'
import { useLang } from '../lib/i18n'

// Classement par compteur permanent d'articles achetés : rang, avatar, nom et
// total (le premier rang ressort en jaune soleil).
export default function StatsPanel({ members }) {
  const { t } = useLang()

  const entries = (members ?? [])
    .map((m) => ({ id: m.id, name: m.display_name, color: m.color, count: m.purchases_count ?? 0 }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

  if (entries.length === 0) {
    return <p className="muted stats-empty">{t('stats_empty')}</p>
  }

  const someone = entries[0].count > 0

  return (
    <ol className="member-stats">
      {entries.map((e, i) => (
        <li key={e.id} className={'member-stat' + (i === 0 && someone ? ' is-leader' : '')}>
          <span className="ms-rank">{i + 1}</span>
          <Avatar name={e.name} color={e.color} size={34} />
          <span className="ms-name">{e.name}</span>
          <span className="ms-count">
            <strong>{e.count}</strong>
            <span className="ms-unit">{t('stats_items_unit', { n: e.count })}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}
