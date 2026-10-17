import { useState } from 'react'
import Icon from './Icon'
import { useLang } from '../lib/i18n'
import { copyText } from '../lib/clipboard'

// Ciel peint « Grand ciel » : plein jour (nuages, oiseaux) ou crépuscule (lune,
// étoiles), selon le thème du téléphone. Les nuages du fond dérivent lentement.
function Sky() {
  return (
    <svg className="sky-art" viewBox="0 0 390 152" preserveAspectRatio="xMaxYMax slice" aria-hidden="true">
      <rect className="sky-fill" width="390" height="152" />
      <g className="sky-day">
        <g className="sky-drift" fill="#FFFFFF" opacity="0.5">
          <ellipse cx="330" cy="30" rx="58" ry="24" />
          <ellipse cx="372" cy="52" rx="44" ry="22" />
          <ellipse cx="278" cy="20" rx="36" ry="16" />
        </g>
        <g className="sky-bank">
          <ellipse cx="302" cy="124" rx="80" ry="42" />
          <ellipse cx="364" cy="106" rx="58" ry="36" />
          <ellipse cx="238" cy="142" rx="54" ry="26" />
        </g>
        <g className="sky-birds" strokeWidth="1.8" strokeLinecap="round" fill="none">
          <path d="M92 48c3.5-3.5 6-3.5 9.5 0" />
          <path d="M118 36c3.5-3.5 6-3.5 9.5 0" />
          <path d="M74 66c2.8-2.8 4.8-2.8 7.6 0" />
        </g>
      </g>
      <g className="sky-night">
        <circle cx="322" cy="44" r="22" fill="#F0C06A" />
        <g fill="#EEE6D6">
          <circle cx="92" cy="34" r="1.6" />
          <circle cx="140" cy="22" r="1.2" />
          <circle cx="188" cy="46" r="1.5" />
          <circle cx="238" cy="26" r="1.1" />
          <circle cx="66" cy="62" r="1.3" />
          <circle cx="268" cy="62" r="1.4" />
        </g>
        <g fill="#2E4670">
          <ellipse cx="300" cy="128" rx="82" ry="40" />
          <ellipse cx="364" cy="110" rx="58" ry="34" />
          <ellipse cx="234" cy="144" rx="54" ry="26" />
        </g>
      </g>
    </svg>
  )
}

export default function Header({ household, onShowStats, onOpenSettings, hideSettingsBtn, settingsBtnRef }) {
  const { t } = useLang()
  const [copied, setCopied] = useState(false)

  async function copyCode() {
    const ok = await copyText(household.join_code)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <header className="appbar">
      <Sky />
      <div className="appbar-inner">
        <div className="appbar-text">
          <h1>{household.name}</h1>
          <button type="button" className="code-chip" onClick={copyCode} title={t('copy_code')}>
            {copied ? t('copied') : household.join_code}
          </button>
        </div>
        <button
          type="button"
          className="icon-btn"
          onClick={onShowStats}
          aria-label={t('stats_title')}
          title={t('stats_title')}
        >
          <Icon name="users" size={21} />
        </button>
        <button
          ref={settingsBtnRef}
          type="button"
          className="icon-btn"
          onClick={onOpenSettings}
          aria-label={t('settings_title')}
          title={t('settings_title')}
          style={{ opacity: hideSettingsBtn ? 0 : 1 }}
        >
          <Icon name="sliders" size={21} />
        </button>
      </div>
    </header>
  )
}
