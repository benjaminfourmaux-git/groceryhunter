import { useLayoutEffect, useRef, useState } from 'react'
import Icon from './Icon'
import { useLang } from '../lib/i18n'
import { setThemePref, useEffectiveTheme } from '../lib/theme'
import { EASE, EXIT_MS, useReducedMotion } from '../lib/motion'
import {
  animatePanelMotion, freezePanelMotion, usePanelDialog,
} from './BottomSheet'
import './PanelMotion.css'

const MARGIN = 10
const SPRING = 'cubic-bezier(0.34, 1.15, 0.55, 1)'
const SURFACE_PROPERTIES = ['transform', 'opacity', 'borderRadius']

// FLIP : le panneau et son contenu sont disposés à leur taille finale une
// seule fois. Seule la surface de fond grandit depuis le bouton ⋯ ; les textes
// et l'icône ne sont jamais mis à l'échelle. Le rayon compense le scale initial
// pour partir d'un vrai cercle, puis retrouver exactement le rayon du design.
export default function SettingsMenu({ open, onClose, onClosed, anchorRef, onLeave }) {
  const { t, lang, toggleLang } = useLang()
  const theme = useEffectiveTheme()
  const reduced = useReducedMotion()
  const [mounted, setMounted] = useState(open)
  const [viewportVersion, setViewportVersion] = useState(0)
  const morphRef = useRef(null)
  const surfaceRef = useRef(null)
  const menuRef = useRef(null)
  const geometryRef = useRef(null)
  const callbacks = useRef({ onClose, onClosed, open })
  callbacks.current = { onClose, onClosed, open }

  useLayoutEffect(() => {
    if (open) setMounted(true)
  }, [open])

  // Le focus reste dans le dialogue jusqu'à sa disparition. Une autre feuille
  // ouverte depuis celui-ci prend la priorité sur Échap et la restitution.
  usePanelDialog(morphRef, mounted, () => {
    if (callbacks.current.open) callbacks.current.onClose()
  }, anchorRef)

  useLayoutEffect(() => {
    if (!mounted) return
    const viewport = window.visualViewport
    const update = () => setViewportVersion((version) => version + 1)
    window.addEventListener('resize', update)
    viewport?.addEventListener('resize', update)
    viewport?.addEventListener('scroll', update)
    return () => {
      window.removeEventListener('resize', update)
      viewport?.removeEventListener('resize', update)
      viewport?.removeEventListener('scroll', update)
    }
  }, [mounted])

  useLayoutEffect(() => {
    const morph = morphRef.current
    const surface = surfaceRef.current
    const menu = menuRef.current
    if (!mounted || !morph || !surface || !menu) return

    const previous = geometryRef.current
    const visual = previous ? surface.getBoundingClientRect() : null
    freezePanelMotion(surface, SURFACE_PROPERTIES)
    freezePanelMotion(menu, ['opacity'])

    const viewport = window.visualViewport
    const left = viewport?.offsetLeft || 0
    const top = viewport?.offsetTop || 0
    const width = viewport?.width || window.innerWidth
    const bottom = top + (viewport?.height || window.innerHeight)
    const b = anchorRef?.current?.getBoundingClientRect() || {
      left: left + width - MARGIN - 44, right: left + width - MARGIN,
      top: top + MARGIN, width: 44, height: 44,
    }
    const radius = b.height / 2
    const finalRight = Math.min(left + width - MARGIN, Math.max(left + MARGIN + b.width, b.right))
    const finalLeft = Math.max(left + MARGIN, left + (left + width - finalRight))
    const panelWidth = Math.max(b.width, finalRight - finalLeft)
    const panelTop = Math.max(top + MARGIN, Math.min(b.top, bottom - MARGIN - b.height))
    const availableHeight = Math.max(1, bottom - panelTop - MARGIN)

    menu.style.width = panelWidth + 'px'
    menu.style.height = 'auto'
    menu.style.maxHeight = `max(1px, calc(${availableHeight}px - env(safe-area-inset-bottom, 0px)))`
    const panelHeight = menu.offsetHeight
    menu.style.height = panelHeight + 'px'
    Object.assign(morph.style, {
      left: finalRight - panelWidth + 'px', top: panelTop + 'px',
      width: panelWidth + 'px', height: panelHeight + 'px', borderRadius: radius + 'px',
    })

    const roundScaleX = b.width / panelWidth
    const roundScaleY = b.height / panelHeight
    const roundTransform = `translate(${b.right - finalRight}px, ${b.top - panelTop}px) scale(${roundScaleX}, ${roundScaleY})`
    const roundRadius = `${radius / roundScaleX}px / ${radius / roundScaleY}px`
    if (visual) {
      // Une inversion ou un redimensionnement repart du rectangle visible,
      // même si le clavier ou Safari a changé la zone disponible entre-temps.
      surface.style.transform = `translate(${visual.right - finalRight}px, ${visual.top - panelTop}px) scale(${visual.width / panelWidth}, ${visual.height / panelHeight})`
    } else {
      Object.assign(surface.style, { transform: roundTransform, borderRadius: roundRadius, opacity: '0' })
      menu.style.opacity = '0'
    }
    geometryRef.current = { width: panelWidth, height: panelHeight }

    const progress = visual ? Math.max(
      Math.abs(visual.width - b.width) / Math.max(1, panelWidth - b.width),
      Math.abs(visual.height - b.height) / Math.max(1, panelHeight - b.height)
    ) : 0
    const duration = (open ? 300 : EXIT_MS) * Math.min(1, Math.max(0, open ? 1 - progress : progress))
    animatePanelMotion(menu, { opacity: open ? '1' : '0' }, {
      duration: open ? Math.min(240, duration) : Math.min(160, duration),
      delay: open && !previous ? 60 : 0, easing: EASE, reduced,
    })
    animatePanelMotion(surface, {
      transform: open ? 'translate(0px, 0px) scale(1, 1)' : roundTransform,
      borderRadius: open ? radius + 'px' : roundRadius,
      opacity: open ? '1' : '0',
    }, {
      duration, easing: open ? SPRING : EASE, reduced,
      onFinish: open ? undefined : () => {
        if (callbacks.current.open) return
        geometryRef.current = null
        setMounted(false)
        callbacks.current.onClosed?.()
      },
    })

    return () => {
      // Sauvegarder AVANT cancel : l'effet suivant pourra inverser le mouvement
      // sans revenir au début ni laisser une ancienne sortie appeler onClosed.
      freezePanelMotion(surface, SURFACE_PROPERTIES)
      freezePanelMotion(menu, ['opacity'])
    }
  }, [mounted, open, anchorRef, reduced, lang, viewportVersion])

  if (!mounted) return null

  return (
    <>
      <div className={'morph-scrim panel-morph-scrim' + (open ? ' is-open' : '')} onClick={() => open && onClose()} />
      <div
        ref={morphRef}
        className={'morph panel-morph' + (open ? ' is-open' : '')}
        role="dialog"
        aria-modal="true"
        aria-label={t('settings_title')}
        tabIndex={-1}
      >
        <div ref={surfaceRef} className="morph panel-morph-surface" aria-hidden="true" />
        <span className="morph-icon" aria-hidden="true">
          <Icon name="more" size={20} />
        </span>
        <div ref={menuRef} className="morph-menu" inert={open ? undefined : ''} aria-hidden={!open}>
          <div className="sheet-head">
            <h2>{t('settings_title')}</h2>
          </div>
          <div className="settings-list">
            <div className="settings-row">
              <span className="settings-label">{t('settings_theme')}</span>
              <div className="seg" role="group" aria-label={t('settings_theme')}>
                <button
                  type="button"
                  className={'seg-btn' + (theme === 'light' ? ' active' : '')}
                  aria-pressed={theme === 'light'}
                  onClick={() => setThemePref('light')}
                >
                  <Icon name="sun" size={14} strokeWidth={2.2} />
                  {t('theme_light_short')}
                </button>
                <button
                  type="button"
                  className={'seg-btn' + (theme === 'dark' ? ' active' : '')}
                  aria-pressed={theme === 'dark'}
                  onClick={() => setThemePref('dark')}
                >
                  <Icon name="moon" size={14} strokeWidth={2.2} />
                  {t('theme_dark_short')}
                </button>
              </div>
            </div>
            <div className="settings-row">
              <span className="settings-label">{t('settings_language')}</span>
              <div className="seg" role="group" aria-label={t('settings_language')}>
                {[
                  ['fr', 'FR', 'Français'],
                  ['en', 'EN', 'English'],
                ].map(([code, short, name]) => (
                  <button
                    key={code}
                    type="button"
                    className={'seg-btn narrow' + (lang === code ? ' active' : '')}
                    aria-pressed={lang === code}
                    aria-label={name}
                    onClick={() => lang !== code && toggleLang()}
                  >
                    {short}
                  </button>
                ))}
              </div>
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
