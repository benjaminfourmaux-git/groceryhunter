// Banc de comportement sans Supabase : les vrais composants et leurs hooks,
// des articles jetables en mémoire. Ouvrir /tests/browser.html avec Vite.
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import ShoppingList from '../src/components/ShoppingList'
import History from '../src/components/History'
import Header from '../src/components/Header'
import AddBar from '../src/components/AddBar'
import BottomSheet from '../src/components/BottomSheet'
import SettingsMenu from '../src/components/SettingsMenu'
import GroupPanel from '../src/components/GroupPanel'
import Onboarding from '../src/components/Onboarding'
import Toast from '../src/components/Toast'
import { useLang } from '../src/lib/i18n'
import { T1_MS, T2_MS } from '../src/lib/config'
import { initPress } from '../src/lib/press'
import { setThemePref, useEffectiveTheme, useThemePref } from '../src/lib/theme'
import { keyboardHeight, reduceMedia } from './browser-env'
import { useLifecycleClock } from '../src/lib/lifecycle'
import useKeyboardDock from '../src/lib/useKeyboardDock'
import useTabGesture from '../src/lib/useTabGesture'
import '../src/index.css'

const stamp = Date.now()
const seed = Array.from({ length: 18 }, (_, i) => ({ id: `qa-${i}`, name: ['Tomates', 'Pain complet', 'Pommes', 'Lait', 'Carottes'][i % 5], quantity: i % 3 ? '' : '500 g', added_by: 'alice', bought_by: null, bought_at: null, created_at: new Date(stamp - i * 1000).toISOString() }))
const members = { alice: { display_name: 'Alice', color: 'prairie' } }
const sleep = async (ms) => { await new Promise((resolve) => setTimeout(resolve, ms)); await new Promise(requestAnimationFrame) }
const pointer = (node, type, x, y) => node.dispatchEvent(new PointerEvent(type, { bubbles: true, isPrimary: true, pointerId: 44, pointerType: 'touch', button: 0, clientX: x, clientY: y }))
// Un écran tactile peut signaler la sortie du pointeur après le relâchement,
// avant son clic de compatibilité. .click() seul ne couvre pas cette séquence.
const touchClick = (node, x = 340, y = 160) => {
  pointer(node, 'pointerdown', x, y)
  pointer(node, 'pointerup', x, y)
  pointer(node, 'pointerout', x, y)
  node.dispatchEvent(new PointerEvent('pointerleave', { isPrimary: true, pointerId: 44, pointerType: 'touch', clientX: x, clientY: y }))
  node.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1, button: 0, clientX: x, clientY: y }))
}

export default function Sandbox() {
  const { t, lang, toggleLang } = useLang()
  const [items, setItems] = useState(seed)
  const [view, setView] = useState('list')
  const [sheet, setSheet] = useState(false)
  const [settings, setSettings] = useState(false)
  const [menuMounted, setMenuMounted] = useState(false)
  const [group, setGroup] = useState(false)
  const [groupMounted, setGroupMounted] = useState(false)
  const [groupMembers, setGroupMembers] = useState([{ id: 'alice', ...members.alice, purchases_count: 12 }, { id: 'ben', display_name: 'Benjamin', color: 'terre', purchases_count: 8 }])
  const [login, setLogin] = useState(false)
  const [toast, setToast] = useState(null)
  const [report, setReport] = useState('Prêt')
  const viewRef = useRef(view); viewRef.current = view
  const barRef = useRef(null), indicatorRef = useRef(null), anchorRef = useRef(null)
  const groupAnchorRef = useRef(null), dockRef = useRef(null)
  const state = useRef(null), renderCount = useRef(0), deletes = useRef(0), closes = useRef(0), toggles = useRef(0)
  renderCount.current++
  const now = useLifecycleClock(items)
  useKeyboardDock()
  useTabGesture(barRef, indicatorRef, viewRef, setView, login ? 'login' : 'ready')
  useEffect(initPress, [])
  const pref = useThemePref(), theme = useEffectiveTheme()
  state.current = { items, view, lang, toggleLang, pref, theme }
  const sorted = useMemo(() => [...items].sort((a, b) => !!a.bought_at !== !!b.bought_at ? (a.bought_at ? 1 : -1) : a.bought_at ? Date.parse(a.bought_at) - Date.parse(b.bought_at) : Date.parse(b.created_at) - Date.parse(a.created_at)), [items])
  const list = useMemo(() => sorted.filter((it) => !it.bought_at || now - Date.parse(it.bought_at) < T1_MS), [sorted, now])
  const history = useMemo(() => sorted.filter((it) => it.bought_at && now - Date.parse(it.bought_at) >= T1_MS && now - Date.parse(it.bought_at) < T1_MS + T2_MS).reverse(), [sorted, now])
  const toggle = (id, bought) => {
    toggles.current++
    setItems((data) => data.map((it) => it.id === id ? { ...it, bought_at: bought ? new Date().toISOString() : null, bought_by: bought ? 'alice' : null } : it))
  }
  const remove = (id) => { deletes.current++; setItems((data) => data.filter((it) => it.id !== id)) }
  const closeSheet = () => { closes.current++; setSheet(false) }
  const row = (i = 0) => document.querySelector(`[data-flip-id="qa-${i}"]`)
  const box = (i = 0) => row(i).querySelector('.buy-check')
  const listPanel = () => document.getElementById('list-panel')
  function reduce(value) { flushSync(() => { reduceMedia.matches = value; reduceMedia.dispatchEvent(new Event('change')) }) }
  async function verifyRanging(assert) {
    reduce(false)
    flushSync(() => { setLogin(false); setView('list'); setItems(seed.slice(0, 5)) })
    await sleep(500)
    async function sample(label) {
      const nodes = [...document.querySelectorAll('.swipe-row')]
      const starts = [], frames = []
      const nativeAnimate = Element.prototype.animate
      Element.prototype.animate = function (keyframes, options) {
        if (this.dataset.flipId) starts.push({ id: this.dataset.flipId, at: performance.now() - start })
        return nativeAnimate.call(this, keyframes, options)
      }
      const start = performance.now()
      const record = () => frames.push({ at: performance.now() - start, rows: nodes.map((node) => ({
        same: row(Number(node.dataset.flipId.slice(3))) === node,
        top: node.getBoundingClientRect().top,
        entering: node.getAnimations().some((animation) => animation.animationName === 'item-in' && animation.playState === 'running'),
      })) })
      try {
        record()
        flushSync(() => touchClick(box()))
        // Un écho serveur équivalent pendant la confirmation ne doit pas
        // redémarrer le rangement (même avec une autre référence d'objet).
        let echoed = false
        while (performance.now() - start < 600) {
          await new Promise(requestAnimationFrame)
          if (!echoed && performance.now() - start > 60) {
            echoed = true
            flushSync(() => setItems((data) => data.map((it) => ({ ...it }))))
          }
          record()
        }
      } finally {
        Element.prototype.animate = nativeAnimate
      }
      const firstMove = starts[0]?.at ?? Infinity
      const before = frames.filter((frame) => frame.at < firstMove)
      assert(`${label} : cartes immobiles avant le rangement`, before.every((frame) => frame.rows.every((value, index) => Math.abs(value.top - frames[0].rows[index].top) < 1)))
      assert(`${label} : aucune apparition rejouée pendant le déplacement`, frames.every((frame) => frame.rows.every((value) => !value.entering)))
      assert(`${label} : un seul déplacement par carte, même avec un écho`, starts.length === nodes.length && new Set(starts.map((value) => value.id)).size === nodes.length && frames.every((frame) => frame.rows.every((value) => value.same)))
    }
    await sample('Cochage')
    await sample('Décochage')
    flushSync(() => setItems([{ ...seed[0], name: 'Tomates cerises en grappe pour la salade du dimanche', quantity: '500 g' }, ...seed.slice(1, 5)]))
    await sleep(450)
    await sample('Cochage d’un nom long')
    await sample('Décochage d’un nom long')
  }
  async function verify() {
    const results = []
    const initialPrefs = { theme: state.current.pref, lang: state.current.lang }
    const assert = (name, ok) => { results.push({ name, ok: !!ok }); if (!ok) throw new Error(name) }
    try {
      deletes.current = 0
      closes.current = 0
      toggles.current = 0
      reduce(false)
      flushSync(() => { setLogin(false); setView('list'); setItems(seed); setToast(null) })
      await sleep(500)
      listPanel().scrollTop = 0
      flushSync(() => touchClick(box()))
      assert('Tap tactile : sortie après relâchement puis clic accepté une fois', box().getAttribute('aria-pressed') === 'true' && toggles.current === 1)
      flushSync(() => touchClick(box().querySelector('.buy-dot')))
      assert('Tap sur le rond interne : décoche acceptée une fois', box().getAttribute('aria-pressed') === 'false' && toggles.current === 2)
      flushSync(() => {
        const check = box()
        for (const type of ['pointerdown', 'pointerup']) check.dispatchEvent(new PointerEvent(type, { bubbles: true, isPrimary: true, pointerId: 9, pointerType: 'mouse', button: 0, clientX: 340, clientY: 160 }))
        check.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1, button: 0 }))
        check.dispatchEvent(new PointerEvent('pointerout', { bubbles: true, isPrimary: true, pointerId: 9, pointerType: 'mouse' }))
      })
      assert('Clic souris avant la sortie du pointeur accepté une fois', box().getAttribute('aria-pressed') === 'true' && toggles.current === 3)
      flushSync(() => box().click())
      assert('Activation clavier/accessibilité préservée', box().getAttribute('aria-pressed') === 'false' && toggles.current === 4)
      const blockedClick = (type) => {
        const check = box()
        pointer(check, 'pointerdown', 340, 160)
        pointer(check, type, 310, 160)
        pointer(check, 'pointerup', 310, 160)
        pointer(check, 'pointerout', 310, 160)
        check.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1, button: 0 }))
      }
      flushSync(() => blockedClick('pointermove'))
      assert('Glisser depuis la case ne coche pas et ne déplace pas le rond', box().getAttribute('aria-pressed') === 'false' && toggles.current === 4 && getComputedStyle(box()).transform === 'none')
      flushSync(() => blockedClick('pointercancel'))
      assert('Geste tactile annulé : clic résiduel ignoré', toggles.current === 4)
      flushSync(() => {
        const check = box()
        pointer(check, 'pointerdown', 340, 160)
        pointer(check, 'pointerout', 340, 160)
        pointer(check, 'pointerup', 340, 160)
        check.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1, button: 0 }))
      })
      assert('Sortie avant relâchement : tap annulé', toggles.current === 4)
      flushSync(() => {
        const check = box()
        pointer(check, 'pointerdown', 340, 160)
        check.dispatchEvent(new PointerEvent('pointerout', { bubbles: true, isPrimary: false, pointerId: 55, pointerType: 'touch' }))
        pointer(check, 'pointerup', 340, 160)
        pointer(check, 'pointerout', 340, 160)
        check.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1, button: 0 }))
      })
      assert('Un second doigt ne désactive pas le tap principal', box().getAttribute('aria-pressed') === 'true' && toggles.current === 5)
      flushSync(() => setItems(seed))
      await sleep(450)
      await verifyRanging(assert)
      flushSync(() => setItems(seed))
      await sleep(450)
      const original = row(), y = row().getBoundingClientRect().top
      flushSync(() => box().click())
      assert('Coche immédiate, même ligne', box().getAttribute('aria-pressed') === 'true' && row() === original)
      await sleep(60)
      assert('Rangement immédiat, sans pause', row().hasAttribute('data-sorting') && Math.abs(row().getBoundingClientRect().top - y) >= 1)
      await sleep(400)
      assert('Rangement terminé sans animation résiduelle', document.querySelector('.swipe-row:last-child') === row() && !row().hasAttribute('data-sorting'))
      flushSync(() => box().click()); await sleep(40); flushSync(() => box().click()); await sleep(450)
      assert('Double action rapide cohérente', box().getAttribute('aria-pressed') === 'true' && !row().hasAttribute('data-sorting'))
      flushSync(() => setItems(seed)); await sleep(400)
      const foreground = row().querySelector('.swipe-fg')
      pointer(foreground, 'pointerdown', 320, 200); pointer(foreground, 'pointermove', 50, 200); pointer(foreground, 'pointercancel', 50, 200)
      assert('Swipe annulé ne supprime rien', deletes.current === 0 && !row().hasAttribute('data-armed') && foreground.style.transform === '')
      const tabbar = barRef.current
      pointer(tabbar, 'pointerdown', 80, 800); pointer(tabbar, 'pointermove', 330, 800); pointer(tabbar, 'pointercancel', 330, 800)
      await sleep(50)
      assert('Onglet annulé ne change pas la page', state.current.view === 'list')
      const retained = row(5)
      listPanel().scrollTop = 300
      const scroll = listPanel().scrollTop
      flushSync(() => setView('history')); await sleep(250); flushSync(() => setView('list')); await sleep(250)
      assert('Onglets : DOM et scroll conservés', row(5) === retained && listPanel().scrollTop === scroll)
      pointer(tabbar, 'pointerdown', 80, 800); pointer(tabbar, 'pointermove', 330, 800); flushSync(() => pointer(tabbar, 'pointerup', 330, 800))
      assert('Glissé d’onglet validé', state.current.view === 'history')
      flushSync(() => setView('list')); listPanel().scrollTop = 0
      const restored = row(2)
      flushSync(() => setItems(seed.filter((it) => it.id !== 'qa-2')))
      assert('Suppression distante : sortie présente', row(2)?.hasAttribute('data-exiting'))
      await sleep(90)
      flushSync(() => setItems(seed))
      assert('Restauration avant la fin : même ligne', row(2) === restored && !row(2).hasAttribute('data-exiting') && row(2).style.height === '')
      const fg = row(3).querySelector('.swipe-fg')
      pointer(fg, 'pointerdown', 320, 200); pointer(fg, 'pointermove', 30, 200); flushSync(() => pointer(fg, 'pointerup', 30, 200))
      // La bande devient entièrement rouge puis se replie aussitôt, lentement,
      // dans la continuité du geste ; l'article est supprimé une fois replié.
      const swiped = row(3)
      const swipedHeight = swiped.offsetHeight
      assert('Swipe validé : rien de supprimé pendant le glissé', deletes.current === 0 && !swiped.hasAttribute('data-exiting'))
      await sleep(240)
      assert('Swipe validé : bande entièrement rouge, repli sans pause', deletes.current === 0 && Math.abs(new DOMMatrix(getComputedStyle(fg).transform).m41) >= fg.offsetWidth - 1 && swiped.offsetHeight < swipedHeight)
      await sleep(400)
      assert('Swipe validé : suppression une fois replié', deletes.current === 1)
      await sleep(320)
      assert('Suppression terminée, espace retiré', !row(3))
      flushSync(() => setItems([{ ...seed[0], bought_at: new Date(Date.now() - T1_MS + 350).toISOString(), bought_by: 'alice' }, seed[1]]))
      await sleep(430)
      assert('T1 : sortie progressive et entrée historique', row()?.hasAttribute('data-exiting') && document.querySelectorAll('#history-panel .hist-item').length === 1)
      await sleep(280)
      assert('T1 : ligne et séparateur retirés proprement', !row() && !document.querySelector('.list-sep'))
      flushSync(() => { setView('history'); setItems([{ ...seed[0], bought_at: new Date(Date.now() - T1_MS - T2_MS + 350).toISOString() }]) })
      await sleep(430)
      assert('T2 : sortie progressive de l’historique', document.querySelector('#history-panel .hist-item')?.hasAttribute('data-exiting'))
      await sleep(280)
      assert('T2 : historique vide après sortie', !document.querySelector('#history-panel .hist-item'))
      flushSync(() => { setItems([{ ...seed[0], bought_at: new Date().toISOString() }, seed[1]]); setView('list') })
      await sleep(450)
      const renders = renderCount.current
      await sleep(1200)
      assert('Anneau : pas de rendu global chaque seconde', renderCount.current === renders)
      listPanel().scrollTop = 0
      const nameInput = document.querySelector('.add-name')
      const tabsBottom = tabbar.getBoundingClientRect().bottom
      const headerTop = document.querySelector('.appbar').getBoundingClientRect().top
      nameInput.focus({ preventScroll: true })
      await sleep(320) // iOS peut annoncer sa hauteur seulement en fin d'ouverture.
      keyboardHeight(300)
      await new Promise(requestAnimationFrame)
      assert('Clavier annoncé tard : déplacement encore animé', parseFloat(document.documentElement.style.getPropertyValue('--kb-duration')) > 0)
      await sleep(250)
      assert('Clavier : en-tête et onglets fixes', Math.abs(document.querySelector('.appbar').getBoundingClientRect().top - headerTop) < 1 && Math.abs(tabbar.getBoundingClientRect().bottom - tabsBottom) < 1)
      assert('Clavier : saisie à 8 px, onglets recouverts', Math.abs(document.querySelector('.add-bar').getBoundingClientRect().bottom - (window.visualViewport.height - 8)) < 2 && tabsBottom > window.visualViewport.height)
      nameInput.blur(); keyboardHeight(null); await sleep(300)
      assert('Clavier fermé : barre revenue à sa place', Math.abs(tabbar.getBoundingClientRect().bottom - tabsBottom) < 1 && parseFloat(document.documentElement.style.getPropertyValue('--kb-lift')) === 0)
      nameInput.focus({ preventScroll: true }); keyboardHeight(100); await sleep(30)
      const firstDuration = parseFloat(document.documentElement.style.getPropertyValue('--kb-duration'))
      keyboardHeight(180); await sleep(35); keyboardHeight(260); await sleep(35); keyboardHeight(300); await sleep(35)
      assert('Clavier en plusieurs étapes : pas de délai relancé', parseFloat(document.documentElement.style.getPropertyValue('--kb-duration')) < firstDuration)
      await sleep(250)
      assert('Clavier progressif : saisie alignée sans retard persistant', Math.abs(document.querySelector('.add-bar').getBoundingClientRect().bottom - (window.visualViewport.height - 8)) < 2)
      nameInput.blur(); keyboardHeight(null); await sleep(300)
      const itemName = row(1).querySelector('.item-name'), originalName = itemName.textContent
      state.current.toggleLang(); await sleep(50)
      assert('Langue : contenu utilisateur stable, sans animation globale', itemName.textContent === originalName && itemName.getAnimations().length === 0 && document.getAnimations().every((animation) => animation.effect?.target !== document.documentElement))
      state.current.toggleLang(); await sleep(250)
      const previousTheme = state.current.pref, oldColor = getComputedStyle(document.documentElement).backgroundColor
      setThemePref(state.current.theme === 'dark' ? 'light' : 'dark'); await sleep(350)
      assert('Thème : nouvelle palette appliquée', getComputedStyle(document.documentElement).backgroundColor !== oldColor)
      setThemePref(previousTheme); await sleep(350)
      flushSync(() => { setMenuMounted(true); setSettings(true) }); await sleep(50)
      flushSync(() => setSettings(false)); await sleep(60); flushSync(() => setSettings(true)); await sleep(400)
      assert('Réglages : ouverture inversée sans fermeture fantôme', !!document.querySelector('.panel-morph') && document.querySelector('.panel-morph').contains(document.activeElement))
      flushSync(() => setSettings(false)); await sleep(400)
      assert('Réglages : fermeture et focus rendus', !document.querySelector('.panel-morph') && document.activeElement === anchorRef.current)
      for (const type of ['settings', 'group']) {
        const anchor = type === 'group' ? groupAnchorRef : anchorRef
        const setOpen = type === 'group' ? setGroup : setSettings
        const setPresent = type === 'group' ? setGroupMounted : setMenuMounted
        const origin = anchor.current.getBoundingClientRect()
        flushSync(() => { setPresent(true); setOpen(true) })
        const surface = document.querySelector('.panel-morph-surface')
        const first = surface.getBoundingClientRect()
        assert(`${type} : surface issue du bouton réel`, Math.abs(first.left - origin.left) < 2 && Math.abs(first.top - origin.top) < 2 && Math.abs(first.width - origin.width) < 2 && Math.abs(first.height - origin.height) < 2)
        await sleep(380)
        const panel = document.querySelector('.panel-morph')
        const icon = panel.querySelector('.morph-icon').getBoundingClientRect()
        const blur = document.querySelector('.panel-backdrop')
        const blurStyle = getComputedStyle(blur)
        assert(`${type} : icône conservée à la position du bouton`, Math.abs(icon.left - origin.left) < 1 && Math.abs(icon.top - origin.top) < 1)
        assert(`${type} : flou limité au-dessus de la barre principale`, /blur\(10px\)/.test(blurStyle.backdropFilter || blurStyle.webkitBackdropFilter) && Math.abs(blur.getBoundingClientRect().bottom - dockRef.current.getBoundingClientRect().top) < 1 && panel.getBoundingClientRect().bottom < dockRef.current.getBoundingClientRect().top && getComputedStyle(dockRef.current).filter === 'none')
        if (type === 'group') {
          assert('Groupe : le bouton reste à l’intérieur du bord supérieur', panel.getBoundingClientRect().right - icon.right > 40 && document.querySelectorAll('.group-panel .member-stat').length === 2)
          flushSync(() => setGroupMembers(Array.from({ length: 18 }, (_, index) => ({ id: `member-${index}`, display_name: `Membre ${index + 1}`, color: 'prairie', purchases_count: index }))))
          await sleep(100)
          const content = panel.querySelector('.morph-menu')
          assert('Groupe nombreux : défilement interne sans couvrir la barre', content.scrollHeight > content.clientHeight && panel.getBoundingClientRect().bottom < dockRef.current.getBoundingClientRect().top && document.documentElement.scrollHeight === document.documentElement.clientHeight)
          flushSync(() => setOpen(false)); await sleep(50); flushSync(() => setOpen(true)); await sleep(380)
          assert('Groupe : réouverture sans fermeture fantôme', !!document.querySelector('.group-panel') && groupAnchorRef.current.style.opacity === '0')
        }
        flushSync(() => document.querySelector('.panel-morph .morph-icon').click())
        await sleep(300)
        assert(`${type} : fermeture par l’icône et focus rendus`, !document.querySelector('.panel-morph') && document.activeElement === anchor.current && anchor.current.style.opacity === '1')
      }
      reduce(true)
      flushSync(() => { setGroupMounted(true); setGroup(true) })
      assert('Groupe : mouvement réduit sans animation', document.querySelector('.group-panel .panel-morph-surface').getAnimations().length === 0)
      flushSync(() => setGroup(false))
      assert('Groupe : mouvement réduit referme immédiatement', !document.querySelector('.group-panel'))
      reduce(false)
      flushSync(() => setGroupMembers([{ id: 'alice', ...members.alice, purchases_count: 12 }, { id: 'ben', display_name: 'Benjamin', color: 'terre', purchases_count: 8 }]))
      flushSync(() => setSheet(true)); await sleep(45)
      const sheetNode = document.querySelector('.modal'), grip = document.querySelector('.modal-grip')
      const beforeDrag = sheetNode.getBoundingClientRect().top
      pointer(grip, 'pointerdown', 100, 600)
      assert('Volet : saisir pendant entrée ne saute pas', Math.abs(sheetNode.getBoundingClientRect().top - beforeDrag) < 2)
      pointer(grip, 'pointermove', 100, 760); pointer(grip, 'pointercancel', 100, 760); await sleep(400)
      assert('Volet : geste annulé reste ouvert', closes.current === 0 && !!document.querySelector('.modal') && Math.abs(new DOMMatrixReadOnly(getComputedStyle(sheetNode).transform).m42) < 1)
      pointer(grip, 'pointerdown', 100, 600); pointer(grip, 'pointermove', 100, 760); pointer(grip, 'pointerup', 100, 760); await sleep(320)
      assert('Volet : geste validé ferme une seule fois', closes.current === 1 && !document.querySelector('.modal'))
      reduce(true)
      flushSync(() => { setItems(seed.slice(0, 3)); setView('list') })
      flushSync(() => box().click())
      assert('Mouvements réduits : rangement sans attente ni FLIP', document.querySelector('.swipe-row:last-child') === row() && !row().hasAttribute('data-sorting'))
      flushSync(() => setItems([seed[1]]))
      assert('Mouvements réduits : retrait sans ligne fantôme', !row())
      flushSync(() => setSheet(true))
      assert('Mouvements réduits : panneau sans animation JS', document.querySelector('.modal').getAnimations().length === 0)
      flushSync(() => setSheet(false)); reduce(false)
      flushSync(() => setToast({ id: 1, msg: 'Premier message' })); await sleep(2000)
      flushSync(() => setToast({ id: 2, msg: 'Second message' })); await sleep(1500)
      assert('Notification remplacée : ancien timer inoffensif', document.querySelector('.toast')?.textContent === 'Second message')
      await sleep(2050)
      assert('Notification : sortie terminée', !document.querySelector('.toast'))
      flushSync(() => { setItems(seed.slice(0, 5)); setLogin(true) })
      await sleep(100)
      assert('Connexion réelle : Rejoindre en premier et par défaut', document.querySelector('.onboarding-tabs button')?.getAttribute('aria-selected') === 'true' && document.querySelector('.onboarding-tabs button')?.textContent === t('tab_join'))
      assert('Connexion : pas de défilement du document', document.documentElement.scrollHeight === document.documentElement.clientHeight && document.body.scrollHeight <= document.documentElement.clientHeight)
    } catch (error) { results.push({ error: error.message }) }
    finally {
      keyboardHeight(null)
      reduce(false)
      if (state.current.pref !== initialPrefs.theme) setThemePref(initialPrefs.theme)
      if (state.current.lang !== initialPrefs.lang) state.current.toggleLang()
    }
    setReport(JSON.stringify(results, null, 2))
  }
  return <>
    {login ? <Onboarding onCreate={async () => { throw new Error('Erreur simulée, aucun compte créé') }} onJoin={async () => { throw new Error('Erreur simulée, aucun compte créé') }} /> : <div className="app">
      <Header household={{ name: 'À la maison', join_code: 'TEST' }} onShowStats={() => { setGroupMounted(true); setGroup(true) }} onOpenSettings={() => { setMenuMounted(true); setSettings(true) }} settingsBtnRef={anchorRef} hideSettingsBtn={menuMounted} statsBtnRef={groupAnchorRef} hideStatsBtn={groupMounted} />
      <div className="content-stack">
        <main id="list-panel" className="content has-cta" data-active={view === 'list'} inert={view !== 'list' ? '' : undefined}><ShoppingList items={list} now={now} memberById={members} onToggleBought={toggle} onDelete={remove} active={view === 'list'} /></main>
        <main id="history-panel" className="content" data-active={view === 'history'} inert={view !== 'history' ? '' : undefined}><History items={history} memberById={members} active={view === 'history'} /></main>
      </div>
      <div className="dock"><div className="dock-ground" ref={dockRef}>
        <div className="add-slot" data-active={view === 'list'} inert={view !== 'list' ? '' : undefined}><div className="add-slot-inner"><AddBar onAdd={(name, quantity) => setItems((data) => [{ ...seed[0], id: `added-${Date.now()}`, name, quantity, created_at: new Date().toISOString() }, ...data])} /></div></div>
        <nav className="tabbar" role="tablist" data-active={view} ref={barRef}><span className="tab-indicator" ref={indicatorRef} />{['list', 'history'].map((mode) => <button key={mode} type="button" role="tab" className={`tab ${view === mode ? 'active' : ''}`} aria-selected={view === mode} onClick={() => setView(mode)}>{t(`tab_${mode}`)}</button>)}</nav>
      </div></div>
      {sheet && <BottomSheet onClose={closeSheet}><h2>Classement</h2><button onClick={closeSheet}>Fermer</button></BottomSheet>}
      <GroupPanel open={group} onClose={() => setGroup(false)} onClosed={() => setGroupMounted(false)} anchorRef={groupAnchorRef} dockRef={dockRef} members={groupMembers} />
      <SettingsMenu open={settings} onClose={() => setSettings(false)} onClosed={() => setMenuMounted(false)} anchorRef={anchorRef} dockRef={dockRef} onLeave={() => setSheet(true)} />
      {toast && <Toast key={toast.id} message={toast.msg} kind="info" onDismiss={() => setToast((current) => current?.id === toast.id ? null : current)} />}
    </div>}
    <details style={{ position: 'fixed', top: 2, left: 2, zIndex: 100, maxWidth: '96vw', maxHeight: '90vh', overflow: 'auto', background: 'var(--nuage)', borderRadius: 12, fontSize: 11 }}><summary>Vérifications locales</summary><button onClick={verify}>Lancer les vérifications</button><button onClick={() => setLogin((value) => !value)}>Liste / connexion de test</button><pre role="status" style={{ whiteSpace: 'pre-wrap' }}>{report}</pre></details>
  </>
}
