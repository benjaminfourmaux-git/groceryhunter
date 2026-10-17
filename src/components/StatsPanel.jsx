import Avatar from './Avatar'
import { useLang } from '../lib/i18n'

// Classement épuré : chaque membre du foyer, avec le nombre total d'articles
// qu'il a achetés depuis toujours (compteur permanent, conservé même après la
// suppression des articles). Trié du plus actif au moins actif ; une barre fine
// matérialise l'écart relatif.
export default function StatsPanel({ members }) {
  const { t } = useLang()

  const entries = (members ?? [])
    .map((m) => ({ id: m.id, name: m.display_name, color: m.color, count: m.purchases_count ?? 0 }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

  if (entries.length === 0) {
    return <p className="muted stats-empty">{t('stats_empty')}</p>
  }

  const max = Math.max(1, entries[0].count)
  const someone = entries[0].count > 0

  return (
    <ul className="member-stats">
      {entries.map((e, i) => (
        <li key={e.id} className={'member-stat' + (i === 0 && someone ? ' is-leader' : '')}>
          <Avatar name={e.name} color={e.color} size={36} />
          <div className="ms-main">
            <span className="ms-name">{e.name}</span>
            <span className="ms-bar" aria-hidden="true">
              <span className="ms-bar-fill" style={{ width: (e.count / max) * 100 + '%' }} />
            </span>
          </div>
          <span className="ms-count">
            <strong>{e.count}</strong>
            <span className="ms-unit">{t('stats_items_unit', { n: e.count })}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
