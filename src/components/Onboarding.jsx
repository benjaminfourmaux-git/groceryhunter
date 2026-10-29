import { useEffect, useId, useRef, useState } from 'react'
import LangToggle from './LangToggle'
import { pickColor } from '../lib/colors'
import { useLang } from '../lib/i18n'
import { iosFocusHandlers } from '../lib/iosFocus'
import './Onboarding.css'

// Décor « Grand ciel — connexion » : le ciel remplit l'écran (oiseaux le jour,
// lune et étoiles le soir), des nuages posés sur l'horizon, la prairie en bas.
function Scenery() {
  return (
    <div className="onboarding-scenery" aria-hidden="true">
      <svg className="onboarding-birds" viewBox="0 0 390 60" fill="none" focusable="false">
        <g className="onboarding-day" stroke="#FDFBF5" strokeWidth="1.8" strokeLinecap="round">
          <path d="M44 24c3.5-3.5 6-3.5 9.5 0" />
          <path d="M70 14c3.5-3.5 6-3.5 9.5 0" />
          <path d="M28 40c2.8-2.8 4.8-2.8 7.6 0" />
        </g>
        <g className="onboarding-night" fill="var(--encre)">
          <circle cx="40" cy="20" r="1.4" /><circle cx="96" cy="38" r="1.1" />
          <circle cx="300" cy="14" r="1.2" /><circle cx="352" cy="44" r="1.5" />
        </g>
      </svg>
      <svg className="onboarding-clouds" viewBox="0 0 390 110" fill="none" focusable="false">
        <circle className="onboarding-night" cx="300" cy="26" r="16" fill="var(--soleil)" />
        <g fill="var(--nuage-ciel)">
          <ellipse cx="78" cy="64" rx="84" ry="38" />
          <ellipse cx="164" cy="82" rx="58" ry="26" />
          <ellipse cx="318" cy="56" rx="76" ry="34" />
          <ellipse cx="374" cy="80" rx="52" ry="24" />
        </g>
      </svg>
      <svg className="onboarding-meadow" viewBox="0 0 390 130" fill="none" preserveAspectRatio="xMidYMax slice" focusable="false">
        <path d="M0 38C70 18 150 48 228 32c54-11 110-15 162-6v106H0V38Z" fill="var(--colline)" />
        <path d="M0 70C92 50 170 78 260 62c48-8 92-8 130-2v70H0V70Z" fill="var(--colline-2)" />
        <circle cx="40" cy="54" r="4" fill="#D6513C" />
        <circle cx="92" cy="66" r="3" fill="#E8B23C" />
        <circle cx="148" cy="74" r="3.4" fill="#FDFBF5" />
        <circle cx="216" cy="48" r="4" fill="#D6513C" />
        <circle cx="282" cy="60" r="3" fill="#E8B23C" />
        <circle cx="340" cy="50" r="3.4" fill="#FDFBF5" />
        <circle cx="186" cy="100" r="3" fill="#E8B23C" />
      </svg>
    </div>
  )
}

// Les trois étapes, sous la carte (recouvertes par le clavier quand il s'ouvre).
const STEPS = [
  ['add', 'step_add', <path key="p" d="M12 5v14M5 12h14" />, 2.4],
  ['check', 'step_check', <path key="p" d="M20 6 9 17l-5-5" />, 2.8],
  ['share', 'step_share', <><path d="M17 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9.5" cy="7" r="3.5" /><path d="M22 20v-2a4 4 0 0 0-3-3.9" /></>, 2.2],
]

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
      <Scenery />

      <div className="onboarding-scroll" ref={scrollRef}>
        <section className="onboarding-card">
          <div className="onboarding-language">
            <LangToggle compact />
          </div>
          <img className="onboarding-icon" src="/app-icon-192.png" width="46" height="46" alt="" aria-hidden="true" />
          <h1>{t('app_name')}</h1>
          <p className="onboarding-intro">{t('onboarding_intro')}</p>

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
                    aria-describedby={error?.field === 'code' ? `${id}-error` : undefined}
                  />
                </label>
              )}

              {errorText && <p id={`${id}-error`} className="onboarding-error" role="alert" ref={errorRef}>{errorText}</p>}

              <button type="button" className="onboarding-primary" disabled={busy} onClick={submit}>
                <span aria-live="polite">{busy ? t('busy') : t(tab === 'create' ? 'create_cta' : 'join_cta')}</span>
              </button>
            </fieldset>
          </div>
        </section>

        <ul className="onboarding-steps" aria-label={t('onboarding_steps')}>
          {STEPS.map(([key, label, icon, stroke]) => (
            <li key={key}>
              <span className={`onboarding-step-icon ${key}`} aria-hidden="true">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" focusable="false">{icon}</svg>
              </span>
              <span>{t(label)}</span>
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
