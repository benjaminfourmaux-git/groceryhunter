import { useEffect, useId, useRef, useState } from 'react'
import LangToggle from './LangToggle'
import { pickColor } from '../lib/colors'
import { useLang } from '../lib/i18n'
import { iosFocusHandlers } from '../lib/iosFocus'
import './Onboarding.css'

function Sky() {
  return (
    <div className="onboarding-sky" aria-hidden="true">
      <svg viewBox="0 0 394 330" preserveAspectRatio="xMidYMax slice" focusable="false">
        <g className="onboarding-day">
          <circle cx="34" cy="200" r="24" fill="var(--soleil)" opacity=".8" />
          <g fill="var(--nuage-ciel)" opacity=".4">
            <ellipse cx="315" cy="74" rx="74" ry="23" />
            <ellipse cx="367" cy="63" rx="46" ry="25" />
            <ellipse cx="20" cy="147" rx="65" ry="20" />
          </g>
          <path d="M291 123q5-6 10 0M312 109q4-5 8 0" stroke="var(--nuage-ciel)" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        </g>
        <g className="onboarding-night">
          <path d="M30 176a24 24 0 1 0 29 31 20 20 0 0 1-29-31" fill="var(--soleil)" />
          <g fill="var(--encre)">
            <circle cx="278" cy="55" r="1.5" /><circle cx="331" cy="118" r="1.8" />
            <circle cx="119" cy="38" r="1.2" /><circle cx="42" cy="186" r="1.3" />
            <path d="M240 116l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
          </g>
        </g>
        <path d="M0 276c33-8 65-1 90 11 28-37 77-37 100-12 36-13 57-12 83 4 43-28 81-23 121-11v62H0z" fill="var(--nuage-ciel)" />
        <path d="M0 313c68-26 125 9 192-5 72-18 133 19 202-6v28H0z" fill="var(--fond)" />
      </svg>
    </div>
  )
}

function Meadow() {
  return (
    <svg className="onboarding-meadow" viewBox="0 0 394 115" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      <path d="M0 54C75 22 135 70 221 48c67-18 115-14 173 3v64H0z" fill="var(--colline)" />
      <path d="M0 82c89-20 152 9 225-3 78-13 120-6 169 8v28H0z" fill="var(--colline-2)" />
      <g fill="var(--coquelicot)"><circle cx="34" cy="67" r="3" /><circle cx="274" cy="56" r="3.5" /><circle cx="356" cy="76" r="3" /></g>
      <g fill="var(--soleil)"><circle cx="84" cy="64" r="2.5" /><circle cx="313" cy="66" r="2.5" /></g>
      <g fill="var(--on-accent)"><circle cx="135" cy="77" r="2.7" /><circle cx="220" cy="64" r="2.6" /></g>
    </svg>
  )
}

export default function Onboarding({ onCreate, onJoin }) {
  const { t } = useLang()
  const [tab, setTab] = useState('join')
  const [name, setName] = useState('')
  const [household, setHousehold] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const screenRef = useRef(null)
  const scrollRef = useRef(null)
  const formRef = useRef(null)
  const nameRef = useRef(null)
  const codeRef = useRef(null)
  const errorRef = useRef(null)
  const submittingRef = useRef(false)
  const animationRef = useRef(null)
  const id = useId()
  // Champs : focus sans défilement iOS (pas de sursaut de toute la page).
  const [focusHandlers] = useState(iosFocusHandlers)
  const errorText = error && (error.key ? t(error.key) : error.message)

  // Le clavier passe PAR-DESSUS l'écran, qui ne se recompose pas et ne défile
  // pas : les champs sont placés assez haut pour rester visibles au-dessus.
  useEffect(() => {
    if (!error) return
    const field = error.field === 'name' ? nameRef.current : error.field === 'code' ? codeRef.current : null
    field?.focus({ preventScroll: true })
  }, [error])

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const cancelIfReduced = () => {
      if (!preference.matches) return
      animationRef.current?.cancel()
      animationRef.current = null
    }
    preference.addEventListener('change', cancelIfReduced)
    return () => {
      preference.removeEventListener('change', cancelIfReduced)
      animationRef.current?.cancel()
    }
  }, [])

  function selectTab(next) {
    if (next === tab || submittingRef.current) return
    setTab(next)
    setError(null)
    animationRef.current?.cancel()
    // Déclenché par un changement d'onglet, jamais par une frappe/un re-render.
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      animationRef.current = formRef.current?.animate?.(
        [{ opacity: 0.5, transform: 'translateY(4px)' }, { opacity: 1, transform: 'translateY(0)' }],
        { duration: 220, easing: 'ease-out' }
      )
    }
  }

  function onTabKeyDown(event) {
    let next
    if (event.key === 'Home') next = 'join'
    else if (event.key === 'End') next = 'create'
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') next = tab === 'join' ? 'create' : 'join'
    else return
    event.preventDefault()
    selectTab(next)
    document.getElementById(`${id}-${next}`)?.focus({ preventScroll: true })
  }

  // Touche « OK » / Entrée du clavier dans un champ = valider.
  function submitOnEnter(event) {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing || !event.target.matches('input')) return
    submit(event)
  }

  async function submit(event) {
    event.preventDefault()
    if (submittingRef.current) return
    setError(null)
    if (!name.trim()) {
      setError({ key: 'err_first_name', field: 'name' })
      return
    }
    if (tab === 'join' && !code.trim()) {
      setError({ key: 'err_code', field: 'code' })
      return
    }
    submittingRef.current = true
    setBusy(true)
    try {
      const color = pickColor()
      if (tab === 'create') await onCreate(household, name, color)
      else await onJoin(code, name, color)
      // Le parent prend la suite après succès ; garder busy jusqu'au démontage.
    } catch (err) {
      setError(err?.message ? { message: err.message } : { key: 'err_generic' })
      submittingRef.current = false
      setBusy(false)
    }
  }

  return (
    <main className="onboarding-screen" ref={screenRef} aria-label={t('app_name')}>
      <Sky />
      <div className="onboarding-topline">
        <span className="onboarding-wordmark">{t('onboarding_wordmark')}</span>
        <div className="onboarding-language">
          <LangToggle />
        </div>
      </div>

      <div className="onboarding-scroll" ref={scrollRef}>
        <header className="onboarding-hero">
          <p>{t('onboarding_intro')}</p>
        </header>

        <section className="onboarding-access">
          <div className="onboarding-tabs" role="tablist" aria-label={t('onboarding_access')} data-active={tab}>
            {['join', 'create'].map((mode) => (
              <button
                key={mode}
                id={`${id}-${mode}`}
                type="button"
                role="tab"
                aria-selected={tab === mode}
                aria-controls={`${id}-panel`}
                tabIndex={tab === mode ? 0 : -1}
                disabled={busy}
                onClick={() => selectTab(mode)}
                onKeyDown={onTabKeyDown}
              >
                {t(`tab_${mode}`)}
              </button>
            ))}
          </div>

          <div id={`${id}-panel`} className="onboarding-form" role="tabpanel" aria-labelledby={`${id}-${tab}`} aria-busy={busy} ref={formRef} onKeyDown={submitOnEnter} {...focusHandlers}>
            <fieldset disabled={busy}>
              <label className="onboarding-field" htmlFor={`${id}-name`}>
                <span>{t('first_name')}</span>
                <input
                  id={`${id}-name`}
                  ref={nameRef}
                  name="huntly-search-pseudo"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t('first_name_ph')}
                  autoComplete="off"
                  autoCapitalize="words"
                  enterKeyHint="next"
                  maxLength={40}
                  required
                  aria-invalid={error?.field === 'name' || undefined}
                  aria-describedby={error?.field === 'name' ? `${id}-error` : undefined}
                />
              </label>

              {tab === 'create' ? (
                <label className="onboarding-field" htmlFor={`${id}-home`}>
                  <span>{t('home_name')} <em>{t('optional')}</em></span>
                  <input
                    key="household"
                    id={`${id}-home`}
                    name="household"
                    value={household}
                    onChange={(event) => setHousehold(event.target.value)}
                    placeholder={t('home_name_ph')}
                    autoComplete="off"
                    autoCapitalize="sentences"
                    enterKeyHint="go"
                    maxLength={40}
                  />
                </label>
              ) : (
                <label className="onboarding-field" htmlFor={`${id}-code`}>
                  <span>{t('home_code')}</span>
                  <input
                    key="code"
                    id={`${id}-code`}
                    ref={codeRef}
                    name="home-code"
                    value={code}
                    onChange={(event) => setCode(event.target.value.toUpperCase())}
                    placeholder={t('home_code_ph')}
                    autoCapitalize="characters"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="go"
                    maxLength={6}
                    className="onboarding-code"
                    required
                    aria-invalid={error?.field === 'code' || undefined}
                    aria-describedby={`${id}-hint${error?.field === 'code' ? ` ${id}-error` : ''}`}
                  />
                </label>
              )}

              {errorText && <p id={`${id}-error`} className="onboarding-error" role="alert" ref={errorRef}>{errorText}</p>}

              <button type="button" className="onboarding-primary" disabled={busy} onClick={submit}>
                <span aria-live="polite">{busy ? t('busy') : t(tab === 'create' ? 'create_cta' : 'join_cta')}</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                  <path d="M5 12h14m-5-5 5 5-5 5" />
                </svg>
              </button>
              <p className="onboarding-hint" id={`${id}-hint`}>{t(tab === 'create' ? 'hint_create' : 'hint_join')}</p>
            </fieldset>
          </div>
        </section>
      </div>
      <Meadow />
    </main>
  )
}
