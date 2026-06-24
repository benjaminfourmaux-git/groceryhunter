import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Icon from './Icon'
import LangToggle from './LangToggle'
import CurrencyToggle from './CurrencyToggle'
import { useLang } from '../lib/i18n'

// Menu Réglages « morph » : le rond ⋯ de l'en-tête se métamorphose en un panneau
// liquid-glass rectangulaire (et inversement au clic extérieur). On anime la
// géométrie réelle (width/height/left/top/border-radius) du bouton vers le
// panneau — pas un scale, pour ne pas déformer le contenu. La taille finale est
// mesurée en JS. Courbes en LITTÉRAL : `var()` dans une transition posée en JS
// ne se parse pas sur Safari mobile.
const MARGIN = 10
const SPRING = 'cubic-bezier(0.34, 1.15, 0.55, 1)' // rebond léger (overshoot réduit)
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
const DUR = 0.3 // s

function reduceMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function geomTransition(reduce) {
  if (reduce) return 'none'
  // Pas de transition de border-radius : il reste constant (= rayon du cercle),
  // pour que l'arc haut-droit reste confondu avec le rond à tout instant.
  // On anime aussi le flou (backdrop-filter) et l'ombre : l'état rond n'en a pas
  // (= clone du bouton ⋯), le panneau si → l'échange final est invisible.
  return (
    `left ${DUR}s ${SPRING}, top ${DUR}s ${SPRING}, ` +
    `width ${DUR}s ${SPRING}, height ${DUR}s ${SPRING}, ` +
    `background-color ${DUR}s ${EASE}, border-color ${DUR}s ${EASE}, ` +
    `box-shadow ${DUR}s ${EASE}, ` +
    `-webkit-backdrop-filter ${DUR}s ${EASE}, backdrop-filter ${DUR}s ${EASE}`
  )
}

export default function SettingsMenu({ open, onClose, onClosed, anchorRef, pushState, onEnablePush, onLeave }) {
  const { t } = useLang()
  const [mounted, setMounted] = useState(false)
  const [expanded, setExpanded] = useState(false) // pilote la classe .is-open (fondu du contenu)
  const morphRef = useRef(null)
  const menuRef = useRef(null)

  // On monte dès l'ouverture, et on garde monté le temps de l'anim de fermeture.
  useEffect(() => {
    if (open) setMounted(true)
  }, [open])

  useLayoutEffect(() => {
    const morph = morphRef.current
    const menu = menuRef.current
    const btn = anchorRef?.current
    if (!mounted || !morph || !menu || !btn) return

    const reduce = reduceMotion()
    const b = btn.getBoundingClientRect()
    // Rayon constant = celui du bouton rond (moitié de sa taille). Un carré à ce
    // rayon EST un cercle ; un rectangle au même rayon garde le coin haut-droit
    // (qui reste ancré en (b.right, b.top)) identique au cercle tout du long.
    const radius = b.height / 2

    // Géométrie du bouton (état rond).
    const setRound = () => {
      morph.style.left = b.left + 'px'
      morph.style.top = b.top + 'px'
      morph.style.width = b.width + 'px'
      morph.style.height = b.height + 'px'
      morph.style.borderRadius = radius + 'px'
      // Clone EXACT du bouton ⋯ de l'en-tête : translucide léger, SANS flou ni
      // ombre. C'est ce qui rend l'échange final (morph → vrai bouton) invisible.
      morph.style.backgroundColor = 'rgba(255, 255, 255, 0.18)'
      morph.style.borderColor = 'rgba(255, 255, 255, 0.26)'
      morph.style.boxShadow = 'none'
      morph.style.backdropFilter = 'blur(0px) saturate(100%)'
      morph.style.webkitBackdropFilter = 'blur(0px) saturate(100%)'
    }

    if (open) {
      // Ancrage d'origine : le bord DROIT du panneau reste sous le bouton
      // (b.right) → coin haut-droit confondu avec le cercle. Le bord GAUCHE est
      // placé à la même distance du bord d'écran que le bord droit l'est du sien
      // (marges latérales symétriques) → la largeur en découle.
      const rightGap = window.innerWidth - b.right
      const finalLeft = Math.max(MARGIN, rightGap)
      const PW = b.right - finalLeft
      menu.style.width = PW + 'px'
      menu.style.height = 'auto'
      const natural = menu.scrollHeight
      const H = Math.min(natural, window.innerHeight - b.top - MARGIN)
      menu.style.height = H + 'px'

      const setPanel = () => {
        morph.style.transition = geomTransition(reduce)
        morph.style.left = finalLeft + 'px'
        morph.style.top = b.top + 'px'
        morph.style.width = PW + 'px'
        morph.style.height = H + 'px'
        // border-radius inchangé (radius) : coin haut-droit confondu avec le rond.
        // Valeurs vidées → reprise des règles CSS du panneau (verre + flou + ombre).
        morph.style.backgroundColor = '' // reprend var(--glass-dock) de la feuille
        morph.style.borderColor = ''
        morph.style.boxShadow = ''
        morph.style.backdropFilter = ''
        morph.style.webkitBackdropFilter = ''
        setExpanded(true) // → .is-open : le contenu apparaît en fondu
      }

      // État initial = le rond, figé sans transition.
      morph.style.transition = 'none'
      setRound()
      void morph.offsetWidth // reflow → base de la transition (rond + contenu masqué)

      if (reduce) {
        setPanel()
        return
      }
      // Une frame en « rond » d'abord, puis on morph vers le panneau.
      const raf = requestAnimationFrame(setPanel)
      return () => cancelAnimationFrame(raf)
    }

    // Fermeture : on remétamorphose en rond, le contenu se masque (.is-open off).
    setExpanded(false)
    morph.style.transition = geomTransition(reduce)
    setRound()

    let done = false
    const finish = (e) => {
      if (e && e.propertyName && e.propertyName !== 'width') return
      if (done) return
      done = true
      morph.removeEventListener('transitionend', finish)
      setMounted(false)
      onClosed?.() // morph entièrement résorbé → l'en-tête peut réafficher le ⋯
    }
    if (reduce) {
      finish()
      return
    }
    morph.addEventListener('transitionend', finish)
    const safety = setTimeout(finish, DUR * 1000 + 150) // filet de sécurité
    return () => {
      morph.removeEventListener('transitionend', finish)
      clearTimeout(safety)
    }
  }, [mounted, open, anchorRef])

  // Échap ferme aussi.
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!mounted) return null

  const bellLabel =
    pushState === 'granted' ? t('bell_on')
    : pushState === 'denied' ? t('bell_blocked')
    : t('bell_enable')

  return (
    <>
      {/* Capte le clic extérieur, sans voile de modale (on garde l'effet morph). */}
      <div className="morph-scrim" onClick={onClose} />
      <div
        ref={morphRef}
        className={'morph' + (expanded ? ' is-open' : '')}
        role="dialog"
        aria-modal="true"
        aria-label={t('settings_title')}
      >
        <span className="morph-icon" aria-hidden="true">
          <Icon name="more" size={20} />
        </span>
        <div ref={menuRef} className="morph-menu">
          <div className="sheet-head">
            <h2>{t('settings_title')}</h2>
          </div>
          <div className="settings-list">
            <div className="settings-row">
              <span className="settings-label">{t('settings_notifications')}</span>
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
            <div className="settings-row">
              <span className="settings-label">{t('settings_language')}</span>
              <LangToggle />
            </div>
            <div className="settings-row">
              <span className="settings-label">{t('settings_currency')}</span>
              <CurrencyToggle />
            </div>
            <button
              type="button"
              className="settings-row danger"
              onClick={() => {
                onClose()
                onLeave()
              }}
            >
              <span className="settings-label">{t('leave')}</span>
              <Icon name="logout" size={19} />
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
