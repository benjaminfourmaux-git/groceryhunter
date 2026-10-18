import { useLayoutEffect, useRef, useState } from 'react'
import Icon from './Icon'
import { useLang } from '../lib/i18n'
import { EASE, EXIT_MS, useReducedMotion } from '../lib/motion'
import { animatePanelMotion, freezePanelMotion, usePanelDialog } from './BottomSheet'
import './PanelMotion.css'

const MARGIN = 12
const SPRING = 'cubic-bezier(0.34, 1.15, 0.55, 1)'
const SURFACE_PROPERTIES = ['transform', 'opacity', 'borderRadius']

// Une géométrie et un cycle de vie communs aux panneaux de l'en-tête.
// La surface grandit depuis le bouton réel ; le contenu reste à sa taille
// finale et l'icône conserve sa position, même loin du coin droit du panneau.
export default function MorphPanel({ open, onClose, onClosed, anchorRef, dockRef, title, icon, className = '', layoutKey, children }) {
  const { t, lang } = useLang()
  const reduced = useReducedMotion()
  const [mounted, setMounted] = useState(open)
  const [viewportVersion, setViewportVersion] = useState(0)
  const morphRef = useRef(null)
  const surfaceRef = useRef(null)
  const menuRef = useRef(null)
  const iconRef = useRef(null)
  const backdropRef = useRef(null)
  const geometryRef = useRef(null)
  const callbacks = useRef({ onClose, onClosed, open })
  callbacks.current = { onClose, onClosed, open }

  useLayoutEffect(() => {
    if (open) setMounted(true)
  }, [open])

  usePanelDialog(morphRef, mounted, () => {
    if (callbacks.current.open) callbacks.current.onClose()
  }, anchorRef)

  useLayoutEffect(() => {
    if (!mounted) return
    const viewport = window.visualViewport
    const update = () => setViewportVersion((version) => version + 1)
    const dock = dockRef?.current
    let dockSize = dock ? `${dock.offsetWidth}:${dock.offsetHeight}` : ''
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
      const size = `${dock.offsetWidth}:${dock.offsetHeight}`
      if (size !== dockSize) { dockSize = size; update() }
    })
    if (dock) observer?.observe(dock)
    window.addEventListener('resize', update)
    viewport?.addEventListener('resize', update)
    viewport?.addEventListener('scroll', update)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', update)
      viewport?.removeEventListener('resize', update)
      viewport?.removeEventListener('scroll', update)
    }
  }, [mounted, dockRef])

  useLayoutEffect(() => {
    const morph = morphRef.current
    const surface = surfaceRef.current
    const menu = menuRef.current
    const backdrop = backdropRef.current
    if (!mounted || !morph || !surface || !menu || !backdrop) return

    const previous = geometryRef.current
    const visual = previous ? surface.getBoundingClientRect() : null
    freezePanelMotion(surface, SURFACE_PROPERTIES)
    freezePanelMotion(menu, ['opacity'])
    freezePanelMotion(backdrop, ['opacity'])

    const viewport = window.visualViewport
    const left = viewport?.offsetLeft || 0
    const top = viewport?.offsetTop || 0
    const right = left + (viewport?.width || window.innerWidth)
    const bottom = top + (viewport?.height || window.innerHeight)
    const app = anchorRef?.current?.closest('.app')?.getBoundingClientRect()
    const panelLeft = Math.max(left, app?.left ?? left) + MARGIN
    const panelRight = Math.min(right, app?.right ?? right) - MARGIN
    const panelWidth = Math.max(44, panelRight - panelLeft)
    const b = anchorRef?.current?.getBoundingClientRect() || {
      left: panelRight - 44, right: panelRight, top: top + MARGIN, width: 44, height: 44,
    }
    const radius = b.height / 2
    const dockTop = dockRef?.current?.getBoundingClientRect().top ?? bottom
    const contentBottom = Math.min(bottom, dockTop)
    const panelTop = Math.max(top + MARGIN, Math.min(b.top, contentBottom - MARGIN - b.height))
    const availableHeight = Math.max(b.height, contentBottom - panelTop - MARGIN)

    menu.style.width = panelWidth + 'px'
    menu.style.height = 'auto'
    menu.style.maxHeight = availableHeight + 'px'
    const panelHeight = Math.max(b.height, menu.offsetHeight)
    menu.style.height = panelHeight + 'px'
    Object.assign(morph.style, {
      left: panelLeft + 'px', top: panelTop + 'px',
      width: panelWidth + 'px', height: panelHeight + 'px', borderRadius: radius + 'px',
    })
    // Ce voile couvre le ciel, la liste et la prairie. Le socle de saisie et
    // d'onglets reste net ; le clic extérieur continue de fermer le dialogue.
    backdrop.style.height = Math.max(0, contentBottom) + 'px'
    Object.assign(iconRef.current.style, {
      left: b.left - panelLeft + 'px', top: b.top - panelTop + 'px',
      width: b.width + 'px', height: b.height + 'px',
    })
    menu.style.setProperty('--panel-action-space', panelRight - b.left + 'px')

    const roundScaleX = b.width / panelWidth
    const roundScaleY = b.height / panelHeight
    const roundTransform = `translate(${b.left - panelLeft}px, ${b.top - panelTop}px) scale(${roundScaleX}, ${roundScaleY})`
    const roundRadius = `${radius / roundScaleX}px / ${radius / roundScaleY}px`
    if (visual) {
      surface.style.transform = `translate(${visual.left - panelLeft}px, ${visual.top - panelTop}px) scale(${visual.width / panelWidth}, ${visual.height / panelHeight})`
    } else {
      Object.assign(surface.style, { transform: roundTransform, borderRadius: roundRadius, opacity: '0' })
      menu.style.opacity = '0'
      backdrop.style.opacity = '0'
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
    animatePanelMotion(backdrop, { opacity: open ? '1' : '0' }, {
      duration: Math.min(240, duration), easing: EASE, reduced,
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
      freezePanelMotion(surface, SURFACE_PROPERTIES)
      freezePanelMotion(menu, ['opacity'])
      freezePanelMotion(backdrop, ['opacity'])
    }
  }, [mounted, open, anchorRef, dockRef, reduced, lang, layoutKey, viewportVersion])

  if (!mounted) return null
  return <>
    <div className={'morph-scrim panel-morph-scrim' + (open ? ' is-open' : '')} onClick={() => open && onClose()}>
      <div className="panel-backdrop" ref={backdropRef} />
    </div>
    <div ref={morphRef} className={'morph panel-morph ' + className + (open ? ' is-open' : '')}
      role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
      <div ref={surfaceRef} className="morph panel-morph-surface" aria-hidden="true" />
      <button ref={iconRef} type="button" className="morph-icon" aria-label={t('close')}
        disabled={!open} onClick={onClose}>
        <Icon name={icon} size={icon === 'users' ? 21 : 20} />
      </button>
      <div ref={menuRef} className="morph-menu" inert={open ? undefined : ''} aria-hidden={!open}>
        <div className="sheet-head"><h2>{title}</h2></div>
        {children}
      </div>
    </div>
  </>
}
