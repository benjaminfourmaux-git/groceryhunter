import Avatar from './Avatar'
import { hashColor } from '../lib/colors'
import { useLang } from '../lib/i18n'

const MEDAL = { 1: '#f5c518', 2: '#c3ccd4', 3: '#cd8032' } // or, argent, bronze

function Trophy({ place }) {
  return (
    <svg className="trophy" viewBox="0 0 24 24" width="22" height="22" fill={MEDAL[place]} aria-hidden="true">
      <path d="M7 4h10v3a5 5 0 0 1-10 0z" />
      <path d="M11 11.5h2V15h3v2H8v-2h3z" />
    </svg>
  )
}

function Podium({ legend, entries, valueKey, colorByName }) {
  const top3 = entries.slice(0, 3)
  const rest = entries.slice(3)
  // Ordre visuel des marches : 2e (gauche), 1er (centre), 3e (droite).
  const layout = [
    { place: 2, entry: top3[1] },
    { place: 1, entry: top3[0] },
    { place: 3, entry: top3[2] },
  ]

  return (
    <div className="podium">
      <p className="podium-legend">{legend}</p>
      <div className="podium-steps">
        {layout.map(({ place, entry }) => (
          <div key={place} className={'pstep p' + place}>
            {entry ? (
              <span className="pstep-top">
                <Trophy place={place} />
                <Avatar name={entry.name} color={colorByName?.[entry.name] ?? hashColor(entry.name)} size={30} />
                <span className="pstep-name">{entry.name}</span>
                <span className="pstep-val">{entry[valueKey]}</span>
              </span>
            ) : (
              <span className="pstep-top empty" aria-hidden="true" />
            )}
            <span className="pstep-block">{place}</span>
          </div>
        ))}
      </div>
      {rest.length > 0 && (
        <ul className="podium-rest">
          {rest.map((e) => (
            <li key={e.name}>
              <span className="r-name">{e.name}</span>
              <span className="r-val">{e[valueKey]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function StatsPanel({ stats, colorByName }) {
  const { t } = useLang()

  if (!stats || stats.length === 0) {
    return <p className="muted stats-empty">{t('stats_empty')}</p>
  }

  const byTrips = [...stats].sort((a, b) => b.trips - a.trips || a.name.localeCompare(b.name))
  const byItems = [...stats].sort((a, b) => b.items - a.items || a.name.localeCompare(b.name))

  return (
    <div className="stats-podiums">
      <Podium legend={t('stats_trips')} entries={byTrips} valueKey="trips" colorByName={colorByName} />
      <Podium legend={t('stats_items')} entries={byItems} valueKey="items" colorByName={colorByName} />
    </div>
  )
}
