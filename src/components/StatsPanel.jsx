import Avatar from './Avatar'
import { useLang } from '../lib/i18n'

// Classement épuré : chaque membre du foyer, avec le nombre de fois qu'il a fait
// les courses. Tous les membres apparaissent (0 si jamais sorti). Trié du plus
// actif au moins actif ; une barre fine matérialise l'écart relatif.
export default function StatsPanel({ members, stats }) {
  const { t } = useLang()

  const tripsByName = Object.fromEntries((stats ?? []).map((s) => [s.name, s.trips]))
  const entries = (members ?? [])
    .map((m) => ({
      id: m.id,
      name: m.display_name,
      color: m.color,
      trips: tripsByName[m.display_name] ?? 0,
    }))
    .sort((a, b) => b.trips - a.trips || a.name.localeCompare(b.name))

  if (entries.length === 0) {
    return <p className="muted stats-empty">{t('stats_empty')}</p>
  }

  const max = Math.max(1, entries[0].trips)
  const someoneShopped = entries[0].trips > 0

  return (
    <ul className="member-stats">
      {entries.map((e, i) => (
        <li key={e.id} className={'member-stat' + (i === 0 && someoneShopped ? ' is-leader' : '')}>
          <Avatar name={e.name} color={e.color} size={36} />
          <div className="ms-main">
            <span className="ms-name">{e.name}</span>
            <span className="ms-bar" aria-hidden="true">
              <span className="ms-bar-fill" style={{ width: (e.trips / max) * 100 + '%' }} />
            </span>
          </div>
          <span className="ms-count">
            <strong>{e.trips}</strong>
            <span className="ms-unit">{t('stats_trips_unit', { n: e.trips })}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
