import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import LangToggle from './LangToggle'
import { pickColor } from '../lib/colors'
import { useLang } from '../lib/i18n'
import './Onboarding.css'

function revealWithin(scroller, element) {
  if (!scroller || !element) return
  const viewport = scroller.getBoundingClientRect()
  const target = element.getBoundingClientRect()
  if (target.top < viewport.top + 12) {
    scroller.scrollTop += target.top - viewport.top - 12
  } else if (target.bottom > viewport.bottom - 12) {
    scroller.scrollTop += target.bottom - viewport.bottom + 12
  }
}

function Sky() {
  return (
    <div className="onboarding-sky" aria-hidden="true">
      <svg viewBox="0 0 394 330" preserveAspectRatio="xMidYMid slice" focusable="false">
        <g className="onboarding-day">
          <circle cx="70" cy="112" r="27" fill="var(--soleil)" opacity=".8" />
          <g fill="var(--nuage-ciel)" opacity=".4">
            <ellipse cx="315" cy="74" rx="74" ry="23" />
            <ellipse cx="367" cy="63" rx="46" ry="25" />
            <ellipse cx="20" cy="147" rx="65" ry="20" />
          </g>
          <path d="M291 123q5-6 10 0M312 109q4-5 8 0" stroke="var(--nuage-ciel)" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        </g>
        <g className="onboarding-night">
          <path d="M70 83a24 24 0 1 0 29 31 20 20 0 0 1-29-31" fill="var(--soleil)" />
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

function Basket() {
  return (
    <svg className="onboarding-basket" viewBox="0 0 84 78" fill="none" aria-hidden="true" focusable="false">
      <ellipse cx="43" cy="71" rx="25" ry="4" fill="var(--encre)" opacity=".07" />
      <path d="M43 27l9-14c2-4 8-6 10-3s0 7-2 11L51 37" fill="#d48b52" />
      <path d="M53 13c-3-8 2-11 4-7 2-8 8-7 6-1 7-4 10 0 4 4" fill="var(--prairie)" />
      <path d="M26 33c-1-13 3-22 8-24 3 5 5 16 1 29" fill="var(--colline)" />
      <path d="M31 33c7-14 12-16 16-14 0 8-6 16-13 20" fill="var(--prairie)" />
      <path d="M21 37c-8-2-9-11-5-15 5-4 10-3 13 2 5-3 10 0 10 6 0 7-7 12-18 7" fill="var(--coquelicot)" />
      <path d="M20 22c-2-6 0-9 2-10" stroke="var(--prairie)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M13 34h58l-7 31a6 6 0 0 1-6 5H26a6 6 0 0 1-6-5z" fill="var(--nuage)" stroke="var(--prairie)" strokeWidth="2.5" />
      <path d="M27 39l8-17M57 39l-8-17" stroke="var(--prairie)" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M30 48v12M42 48v12M54 48v12" stroke="var(--prairie)" strokeWidth="2" strokeLinecap="round" opacity=".45" />
    </svg>
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
  const { t, lang } = useLang()
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
  const errorText = error && (error.key ? t(error.key) : error.message)

  // Safari conserve un layout viewport haut derrière le clavier. La coque suit
  // uniquement le VisualViewport ; seul le contenu intérieur peut défiler.
  // Variables locales : aucun changement sur html/body ni sur les vars de l'app.
  useLayoutEffect(() => {
    const screen = screenRef.current
    const viewport = window.visualViewport
    let frame = 0
    const sync = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const height = viewport?.height ?? window.innerHeight
        const focused = screen.contains(document.activeElement) && document.activeElement.matches('input')
        // Conserver la composition clavier si le focus passe au bouton avant
        // que Safari ait effectivement rendu la hauteur disponible.
        const keyboard = document.documentElement.clientHeight - height > 120 &&
          (focused || screen.dataset.keyboard === 'true')
        screen.style.setProperty('--onboarding-height', `${height}px`)
        screen.style.setProperty('--onboarding-top', `${viewport?.offsetTop ?? 0}px`)
        screen.dataset.keyboard = keyboard ? 'true' : 'false'
        if (focused) revealWithin(scrollRef.current, document.activeElement)
      })
    }
    viewport?.addEventListener('resize', sync)
    viewport?.addEventListener('scroll', sync)
    window.addEventListener('resize', sync)
    screen.addEventListener('focusin', sync)
    screen.addEventListener('focusout', sync)
    sync()
    return () => {
      cancelAnimationFrame(frame)
      viewport?.removeEventListener('resize', sync)
      viewport?.removeEventListener('scroll', sync)
      window.removeEventListener('resize', sync)
      screen.removeEventListener('focusin', sync)
      screen.removeEventListener('focusout', sync)
    }
  }, [])

  useEffect(() => {
    if (!error) return
    const field = error.field === 'name' ? nameRef.current : error.field === 'code' ? codeRef.current : null
    field?.focus({ preventScroll: true })
    revealWithin(scrollRef.current, field || errorRef.current)
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
    <main className="onboarding-screen" ref={screenRef} aria-labelledby={`${id}-title`}>
      <Sky />
      <div className="onboarding-topline">
        <span className="onboarding-wordmark">{t('onboarding_wordmark')}</span>
        <div className="onboarding-language" style={{ '--onboarding-language': `"${lang.toUpperCase()}"` }}>
          <LangToggle />
        </div>
      </div>

      <div className="onboarding-scroll" ref={scrollRef}>
        <header className="onboarding-hero">
          <Basket />
          <h1 id={`${id}-title`}>{t('onboarding_title')}</h1>
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

          <form id={`${id}-panel`} className="onboarding-form" role="tabpanel" aria-labelledby={`${id}-${tab}`} aria-busy={busy} ref={formRef} onSubmit={submit} noValidate>
            <fieldset disabled={busy}>
              <label className="onboarding-field" htmlFor={`${id}-name`}>
                <span>{t('first_name')}</span>
                <input
                  id={`${id}-name`}
                  ref={nameRef}
                  name="given-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t('first_name_ph')}
                  autoComplete="given-name"
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

              <button type="submit" className="onboarding-primary" disabled={busy}>
                <span aria-live="polite">{busy ? t('busy') : t(tab === 'create' ? 'create_cta' : 'join_cta')}</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                  <path d="M5 12h14m-5-5 5 5-5 5" />
                </svg>
              </button>
              <p className="onboarding-hint" id={`${id}-hint`}>{t(tab === 'create' ? 'hint_create' : 'hint_join')}</p>
            </fieldset>
          </form>
        </section>
      </div>
      <Meadow />
    </main>
  )
}
