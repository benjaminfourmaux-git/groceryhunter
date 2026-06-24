import { useState } from 'react'
import Icon from './Icon'
import LangToggle from './LangToggle'
import { pickColor } from '../lib/colors'
import { useLang } from '../lib/i18n'

export default function Onboarding({ onCreate, onJoin }) {
  const { t } = useLang()
  const [tab, setTab] = useState('create') // 'create' | 'join'
  const [name, setName] = useState('')
  const [household, setHousehold] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError(t('err_first_name'))
      return
    }
    setBusy(true)
    try {
      const color = pickColor()
      if (tab === 'create') {
        await onCreate(household, name, color)
      } else {
        if (!code.trim()) {
          setError(t('err_code'))
          setBusy(false)
          return
        }
        await onJoin(code, name, color)
      }
    } catch (err) {
      setError(err.message || t('err_generic'))
      setBusy(false)
    }
  }

  return (
    <div className="onboarding">
      <div className="onboarding-card">
        <div className="onboarding-lang">
          <LangToggle />
        </div>

        <div className="brand">
          <span className="brand-mark">
            <Icon name="cart" size={26} />
          </span>
          <h1>{t('app_name')}</h1>
          <p className="muted">{t('tagline')}</p>
        </div>

        <div className="segmented">
          <button
            type="button"
            className={tab === 'create' ? 'active' : ''}
            onClick={() => { setTab('create'); setError(null) }}
          >
            {t('tab_create')}
          </button>
          <button
            type="button"
            className={tab === 'join' ? 'active' : ''}
            onClick={() => { setTab('join'); setError(null) }}
          >
            {t('tab_join')}
          </button>
        </div>

        <form onSubmit={submit}>
          <label className="field">
            <span>{t('first_name')}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('first_name_ph')}
              autoComplete="given-name"
              maxLength={40}
            />
          </label>

          {tab === 'create' ? (
            <label className="field">
              <span>
                {t('home_name')} <em className="optional">{t('optional')}</em>
              </span>
              <input
                value={household}
                onChange={(e) => setHousehold(e.target.value)}
                placeholder={t('home_name_ph')}
                maxLength={40}
              />
            </label>
          ) : (
            <label className="field">
              <span>{t('home_code')}</span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder={t('home_code_ph')}
                autoCapitalize="characters"
                autoComplete="off"
                maxLength={6}
                className="code-input"
              />
            </label>
          )}

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="btn-primary block" disabled={busy}>
            {busy ? t('busy') : tab === 'create' ? t('create_cta') : t('join_cta')}
          </button>
        </form>

        <p className="muted small">{tab === 'create' ? t('hint_create') : t('hint_join')}</p>
      </div>
    </div>
  )
}
