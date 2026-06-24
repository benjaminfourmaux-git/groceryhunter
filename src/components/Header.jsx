import { useState } from 'react'
import Icon from './Icon'
import Avatar from './Avatar'
import { useLang } from '../lib/i18n'

export default function Header({ household, members, onShowStats, onOpenSettings }) {
  const { t } = useLang()
  const [copied, setCopied] = useState(false)

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(household.join_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Presse-papiers indisponible : on ne bloque pas.
    }
  }

  return (
    <header className="appbar">
      <div className="appbar-row">
        <h1>{household.name}</h1>
        <button
          type="button"
          className="icon-btn"
          onClick={onOpenSettings}
          aria-label={t('settings_title')}
          title={t('settings_title')}
        >
          <Icon name="more" size={20} />
        </button>
      </div>

      <div className="appbar-row">
        <button type="button" className="code-chip" onClick={copyCode} title={t('copy_code')}>
          <span>{copied ? t('copied') : household.join_code}</span>
          <Icon name="copy" size={14} />
        </button>

        <button type="button" className="members-row" onClick={onShowStats} aria-label={t('stats_title')}>
          {members.map((m) => (
            <Avatar key={m.id} name={m.display_name} color={m.color} size={26} />
          ))}
          <span className="members-count">
            <Icon name="users" size={13} />
            {members.length}
          </span>
        </button>
      </div>
    </header>
  )
}
