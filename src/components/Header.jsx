import { useState } from 'react'
import Icon from './Icon'
import Avatar from './Avatar'
import LangToggle from './LangToggle'
import { useLang } from '../lib/i18n'

export default function Header({ household, members, pushState, onEnablePush, onLeave, onShowStats }) {
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

  const bellLabel =
    pushState === 'granted'
      ? t('bell_on')
      : pushState === 'denied'
        ? t('bell_blocked')
        : t('bell_enable')

  return (
    <header className="appbar">
      <div className="appbar-top">
        <div className="appbar-title">
          <h1>{household.name}</h1>
          <button type="button" className="code-chip" onClick={copyCode} title={t('copy_code')}>
            <span>{copied ? t('copied') : household.join_code}</span>
            <Icon name="copy" size={15} />
          </button>
        </div>

        <div className="appbar-actions">
          <button
            type="button"
            className="icon-btn leave"
            onClick={onLeave}
            aria-label={t('leave')}
            title={t('leave')}
          >
            <Icon name="logout" size={19} />
          </button>
          <LangToggle />
          <button
            type="button"
            className={'icon-btn bell ' + pushState}
            onClick={onEnablePush}
            disabled={pushState === 'granted' || pushState === 'denied'}
            aria-label={bellLabel}
            title={bellLabel}
          >
            <Icon name="bell" size={20} />
            {pushState === 'granted' && <span className="bell-dot" />}
          </button>
        </div>
      </div>

      <button type="button" className="members-row" onClick={onShowStats} aria-label={t('stats_title')}>
        {members.map((m) => (
          <Avatar key={m.id} name={m.display_name} color={m.color} size={30} />
        ))}
        <span className="members-count">
          <Icon name="users" size={14} />
          {members.length}
        </span>
      </button>
    </header>
  )
}
