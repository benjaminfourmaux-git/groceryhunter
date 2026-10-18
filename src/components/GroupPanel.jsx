import { useLang } from '../lib/i18n'
import MorphPanel from './MorphPanel'
import StatsPanel from './StatsPanel'

export default function GroupPanel({ members, ...props }) {
  const { t } = useLang()
  return <MorphPanel {...props} title={t('stats_title')} icon="users" className="group-panel" layoutKey={members}>
    <p className="sheet-sub muted">{t('stats_sub')}</p>
    <div className="stats-scroll"><StatsPanel members={members} /></div>
  </MorphPanel>
}
