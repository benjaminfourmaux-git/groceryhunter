import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { supabase, isConfigured } from './supabaseClient'
import * as api from './lib/api'
import { enablePush, pushSupported, pushPermission, pushUnsupportedReason } from './lib/push'
import { initPress } from './lib/press'
import { uuid } from './lib/uuid'
import { T1_MS, T2_MS } from './lib/config'
import { useLang } from './lib/i18n'
import Onboarding from './components/Onboarding'
import Header from './components/Header'
import AddBar from './components/AddBar'
import ShoppingList from './components/ShoppingList'
import History from './components/History'
import StatsPanel from './components/StatsPanel'
import BottomSheet from './components/BottomSheet'
import Icon from './components/Icon'
import SettingsMenu from './components/SettingsMenu'

const boughtMsOf = (it) => (it.bought_at ? Date.parse(it.bought_at) : null)

export default function App() {
  const { t, lang } = useLang()
  const [phase, setPhase] = useState('loading') // loading | onboarding | ready | error
  const [errorMsg, setErrorMsg] = useState(null)
  const [member, setMember] = useState(null)
  const [members, setMembers] = useState([])
  const [items, setItems] = useState([])
  const [now, setNow] = useState(() => Date.now()) // tick 1s : fait vivre les comptes à rebours
  const [view, setView] = useState('list') // list | history
  const [pushState, setPushState] = useState('default')
  const [leaving, setLeaving] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  // Le morph Réglages est « présent » de l'ouverture jusqu'à la FIN de la
  // fermeture : on masque le bouton ⋯ tant qu'il l'est (sinon on verrait le rond
  // par défaut en double pendant la résorption).
  const [menuMounted, setMenuMounted] = useState(false)
  const [toast, setToast] = useState(null)

  const hid = member?.household_id

  const channelRef = useRef(null)
  // Après une mutation locale sur les articles, on a déjà rechargé la liste :
  // on ignore l'écho temps réel (qui arrive plus tard) pour éviter un 2e rendu.
  const skipItemsEchoUntil = useRef(0)
  const cleaning = useRef(false)
  const settingsBtnRef = useRef(null) // ancre du « morph » Réglages (le bouton ⋯)
  const tabbarRef = useRef(null)
  const indicatorRef = useRef(null)
  const viewRef = useRef(view)
  viewRef.current = view

  // Table id → membre : nom + couleur cohérents dans la liste, l'historique, les stats.
  const memberById = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m])), [members])

  // ---- Partition dérivée de l'heure courante -------------------------------
  // À acheter (bought_at vide) + achetés depuis < T1 (compte à rebours, en bas).
  const listItems = useMemo(() => {
    const toBuy = []
    const counting = []
    for (const it of items) {
      const b = boughtMsOf(it)
      if (b == null) toBuy.push(it)
      else if (now - b < T1_MS) counting.push(it)
    }
    toBuy.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)) // récents en haut
    counting.sort((a, b) => boughtMsOf(a) - boughtMsOf(b)) // le dernier acheté tout en bas
    return [...toBuy, ...counting]
  }, [items, now])

  // Historique = achetés depuis ≥ T1 mais < T1+T2.
  const historyItems = useMemo(
    () =>
      items
        .filter((it) => {
          const b = boughtMsOf(it)
          return b != null && now - b >= T1_MS && now - b < T1_MS + T2_MS
        })
        .sort((a, b) => boughtMsOf(b) - boughtMsOf(a)),
    [items, now]
  )

  const toBuyCount = useMemo(() => items.reduce((n, it) => n + (it.bought_at ? 0 : 1), 0), [items])

  const showToast = useCallback((msg, kind = 'info') => {
    setToast({ msg, kind })
    setTimeout(() => setToast(null), 3200)
  }, [])

  const loadItems = useCallback(async (h) => {
    setItems(await api.getItems(h))
  }, [])
  const loadMembers = useCallback(async (h) => {
    setMembers(await api.getMembers(h))
  }, [])

  // Effet « press organique » sur tous les boutons (une seule fois).
  useEffect(() => initPress(), [])

  // Tick 1s : comptes à rebours + bascule liste↔historique quand T1/T2 passent.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // Clavier mobile : l'app garde toute la hauteur de l'écran (le clavier passe
  // par-dessus et cache la barre d'onglets) ; seule la barre d'ajout se soulève
  // pour se poser juste au-dessus du clavier (--kb-lift, animé en CSS).
  // La hauteur du clavier se lit sur le VisualViewport. iOS ne la donne qu'une
  // fois le clavier ouvert : on réutilise la dernière hauteur connue dès le
  // focus, pour que la barre monte en même temps que le clavier.
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const root = document.documentElement
    const GAP = 8 // espace entre la barre d'ajout et le clavier
    let raf = 0
    let lastKb = 0

    const apply = (kb) => {
      const dock = document.querySelector('.dock')
      const tabbar = document.querySelector('.tabbar')
      let under = 0 // distance barre d'ajout → bas de l'écran, clavier fermé
      if (dock && tabbar) {
        const cs = getComputedStyle(dock)
        under = tabbar.offsetHeight + (parseFloat(cs.rowGap) || 0) + (parseFloat(cs.paddingBottom) || 0)
      }
      const lift = kb > 0 ? Math.max(0, kb + GAP - under) : 0
      root.style.setProperty('--kb-lift', lift + 'px')
    }

    const sync = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        root.style.setProperty('--vv-top', vv.offsetTop + 'px')
        const kb = Math.max(0, Math.round(root.clientHeight - vv.height))
        if (kb > 0) lastKb = kb
        apply(kb)
        // Clavier refermé : annule tout reste de défilement du document.
        if (kb === 0 && window.scrollY !== 0) window.scrollTo(0, 0)
      })
    }

    const inAddBar = (el) => !!(el && el.closest && el.closest('.add-bar'))
    const onFocusIn = (e) => {
      if (inAddBar(e.target) && lastKb > 0) apply(lastKb)
    }
    const onFocusOut = (e) => {
      if (inAddBar(e.target) && !inAddBar(e.relatedTarget)) apply(0)
    }

    vv.addEventListener('resize', sync)
    vv.addEventListener('scroll', sync)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    sync()
    return () => {
      cancelAnimationFrame(raf)
      vv.removeEventListener('resize', sync)
      vv.removeEventListener('scroll', sync)
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
    }
  }, [])

  // Mémorise la langue du membre côté serveur → notifications push localisées.
  useEffect(() => {
    if (member?.id) api.setMemberLang(lang)
  }, [lang, member])

  // Nettoyage paresseux : supprime en base les articles achetés depuis > T1+T2
  // (déjà invisibles, filtrés des deux vues). Pur entretien, sans infra serveur.
  useEffect(() => {
    if (!hid || cleaning.current) return
    const cutoffMs = Date.now() - (T1_MS + T2_MS)
    const hasExpired = items.some((it) => {
      const b = boughtMsOf(it)
      return b != null && b < cutoffMs
    })
    if (!hasExpired) return
    cleaning.current = true
    skipItemsEchoUntil.current = Date.now() + 2000
    api
      .cleanupExpired(hid, new Date(cutoffMs).toISOString())
      .then(() =>
        setItems((prev) =>
          prev.filter((it) => {
            const b = boughtMsOf(it)
            return !(b != null && b < Date.now() - (T1_MS + T2_MS))
          })
        )
      )
      .catch(() => {})
      .finally(() => {
        cleaning.current = false
      })
  }, [now, items, hid])

  // Slide Liste/Historique : maintien + déplacement linéaire, aimant au relâchement.
  useEffect(() => {
    const bar = tabbarRef.current
    const ind = indicatorRef.current
    if (!bar || !ind) return

    let active = false
    let pid = null
    let startX = 0
    let startFrac = 0
    let frac = 0
    let moved = false
    let downTab = null

    const place = (f) => {
      frac = Math.max(0, Math.min(1, f))
      ind.style.transform = `translateX(${frac * 100}%)`
    }

    function down(e) {
      active = true
      moved = false
      pid = e.pointerId
      startX = e.clientX
      startFrac = viewRef.current === 'history' ? 1 : 0
      downTab = e.target.closest('.tab')
      ind.style.transition = 'none'
      place(startFrac)
      try {
        bar.setPointerCapture(pid)
      } catch {
        /* noop */
      }
    }
    function move(e) {
      if (!active || e.pointerId !== pid) return
      const step = (bar.clientWidth - 12) / 2 // largeur d'un onglet (padding 6px ×2)
      const dx = e.clientX - startX
      if (Math.abs(dx) > 4) moved = true
      place(startFrac + dx / step)
    }
    function up() {
      if (!active) return
      active = false
      const tabs = bar.querySelectorAll('.tab')
      const target = moved
        ? frac >= 0.5
          ? 'history'
          : 'list'
        : downTab === tabs[1]
          ? 'history'
          : 'list'

      ind.style.transition = ''
      ind.style.transform = `translateX(${target === 'history' ? 100 : 0}%)`
      if (target !== viewRef.current) setView(target)
      const done = () => {
        ind.style.transform = ''
        ind.removeEventListener('transitionend', done)
      }
      ind.addEventListener('transitionend', done)
    }

    bar.addEventListener('pointerdown', down)
    bar.addEventListener('pointermove', move)
    bar.addEventListener('pointerup', up)
    bar.addEventListener('pointercancel', up)
    return () => {
      bar.removeEventListener('pointerdown', down)
      bar.removeEventListener('pointermove', move)
      bar.removeEventListener('pointerup', up)
      bar.removeEventListener('pointercancel', up)
    }
  }, [phase])

  // ---- Démarrage : session anonyme + membre ---------------------------------
  useEffect(() => {
    if (!isConfigured) {
      setPhase('error')
      setErrorMsg('config')
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        await api.ensureAnonymousSession()
        const m = await api.getMyMember()
        if (cancelled) return
        if (m && m.household) {
          setMember(m)
          setPhase('ready')
        } else {
          setPhase('onboarding')
        }
      } catch (err) {
        if (cancelled) return
        setErrorMsg(humanizeStartupError(err))
        setPhase('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // ---- Quand le membre est connu : données, temps réel, push ----------------
  useEffect(() => {
    if (!member?.household) return
    const h = member.household_id

    loadItems(h)
    loadMembers(h)

    if (!pushSupported()) {
      setPushState('unsupported')
    } else {
      setPushState(pushPermission())
      if (pushPermission() === 'granted') {
        enablePush(member).catch(() => {})
      }
    }

    const channel = supabase
      .channel(`household-${h}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'items', filter: `household_id=eq.${h}` },
        () => {
          if (Date.now() < skipItemsEchoUntil.current) return // écho de notre propre mutation
          loadItems(h)
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'members', filter: `household_id=eq.${h}` },
        () => loadMembers(h) // compteur d'achats mis à jour → classement en direct
      )
      .subscribe()

    channelRef.current = channel
    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [member, loadItems, loadMembers])

  // ---- Actions d'onboarding -------------------------------------------------
  async function handleCreate(householdName, displayName, color) {
    await api.createHousehold(householdName, displayName, color)
    const m = await api.getMyMember()
    setMember(m)
    setPhase('ready')
  }
  async function handleJoin(code, displayName, color) {
    await api.joinHousehold(code, displayName, color)
    const m = await api.getMyMember()
    setMember(m)
    setPhase('ready')
  }

  // ---- Actions liste --------------------------------------------------------
  async function handleAdd(name, qty) {
    // Optimistic UI : on génère l'uuid côté client et on l'affiche avant la
    // confirmation serveur (même clé partout → pas de remontage ni double anim).
    const id = uuid()
    const trimmedQty = qty && qty.trim() ? qty.trim() : null
    const optimistic = {
      id,
      name: name.trim(),
      quantity: trimmedQty,
      bought_at: null,
      bought_by: null,
      added_by: member.id,
      created_at: new Date().toISOString(),
    }
    setItems((prev) => [optimistic, ...prev]) // en haut (plus récent)

    try {
      skipItemsEchoUntil.current = Date.now() + 1500
      await api.addItem(hid, member.id, name, qty, id, optimistic.created_at)
    } catch (err) {
      setItems((prev) => prev.filter((it) => it.id !== id)) // rollback
      showToast(err.message || t('err_add'), 'error')
    }
  }

  async function handleDelete(id) {
    const index = items.findIndex((it) => it.id === id)
    if (index === -1) return
    const removed = items[index]
    setItems((prev) => prev.filter((it) => it.id !== id))

    try {
      skipItemsEchoUntil.current = Date.now() + 1500
      await api.deleteItem(id)
    } catch (err) {
      setItems((prev) => {
        const next = [...prev]
        next.splice(Math.min(index, next.length), 0, removed)
        return next
      })
      showToast(err.message || t('err_delete'), 'error')
    }
  }

  // Cocher/décocher « acheté ». Optimistic : on pose/retire bought_at tout de
  // suite (le compte à rebours démarre), le serveur confirme et ajuste le compteur.
  async function handleToggleBought(id, bought) {
    const nowIso = new Date().toISOString()
    const prev = items
    setItems((list) =>
      list.map((it) =>
        it.id === id
          ? { ...it, bought_at: bought ? nowIso : null, bought_by: bought ? member.id : null }
          : it
      )
    )
    try {
      skipItemsEchoUntil.current = Date.now() + 1500
      await api.setItemBought(id, bought)
    } catch (err) {
      setItems(prev) // rollback
      showToast(err.message || t('err_action'), 'error')
    }
  }

  async function handleEnablePush() {
    const reason = pushUnsupportedReason()
    if (reason) {
      const key =
        reason === 'ios-install' ? 'push_ios_install'
        : reason === 'insecure' ? 'push_https'
        : 'push_unsupported'
      showToast(t(key), 'info')
      return
    }
    try {
      await enablePush(member)
      setPushState('granted')
      showToast(t('push_on'), 'success')
    } catch (err) {
      setPushState(pushPermission())
      showToast(err.message || t('err_push'), 'error')
    }
  }

  async function handleLeave() {
    setLeaving(false)
    try {
      await api.leaveHousehold()
      setMember(null)
      setItems([])
      setMembers([])
      setView('list')
      setPhase('onboarding')
    } catch (err) {
      showToast(err.message || t('err_leave'), 'error')
    }
  }

  function handleShowStats() {
    setStatsOpen(true) // les membres portent déjà purchases_count
  }

  // ---- Rendu ----------------------------------------------------------------
  if (phase === 'loading') {
    return (
      <div className="screen-center">
        <div className="spinner" />
      </div>
    )
  }

  if (phase === 'error') {
    return <ErrorScreen which={errorMsg} />
  }

  if (phase === 'onboarding') {
    return <Onboarding onCreate={handleCreate} onJoin={handleJoin} />
  }

  return (
    <div className="app">
      <Header
        household={member.household}
        members={members}
        onShowStats={handleShowStats}
        onOpenSettings={() => { setMenuMounted(true); setSettingsOpen(true) }}
        hideSettingsBtn={menuMounted}
        settingsBtnRef={settingsBtnRef}
      />

      <main className={'content' + (view === 'list' ? ' has-cta' : '')} key={view}>
        {view === 'list' ? (
          <ShoppingList
            items={listItems}
            now={now}
            memberById={memberById}
            onToggleBought={handleToggleBought}
            onDelete={handleDelete}
          />
        ) : (
          <History items={historyItems} memberById={memberById} />
        )}
      </main>

      <div className="dock">
        {view === 'list' && <AddBar onAdd={handleAdd} />}

        <nav className="tabbar" data-active={view} ref={tabbarRef}>
          <span className="tab-indicator" aria-hidden="true" ref={indicatorRef} />
          <button
            type="button"
            className={'tab' + (view === 'list' ? ' active' : '')}
            onClick={() => setView('list')}
          >
            <span className="tab-icon">
              <Icon name="list" size={22} />
              {toBuyCount > 0 && <span className="tab-badge">{toBuyCount}</span>}
            </span>
            <span>{t('tab_list')}</span>
          </button>
          <button
            type="button"
            className={'tab' + (view === 'history' ? ' active' : '')}
            onClick={() => setView('history')}
          >
            <span className="tab-icon">
              <Icon name="history" size={22} />
            </span>
            <span>{t('tab_history')}</span>
          </button>
        </nav>
      </div>

      {leaving && (
        <BottomSheet onClose={() => setLeaving(false)}>
          {(close) => (
            <>
              <span className="modal-emoji danger" aria-hidden="true">
                <Icon name="logout" size={24} />
              </span>
              <h2>{t('leave_title')}</h2>
              <p className="muted">{t('leave_body')}</p>
              <div className="modal-actions">
                <button type="button" className="btn-ghost" onClick={close}>
                  {t('cancel')}
                </button>
                <button type="button" className="btn-danger" onClick={handleLeave}>
                  {t('leave_confirm')}
                </button>
              </div>
            </>
          )}
        </BottomSheet>
      )}

      {statsOpen && (
        <BottomSheet className="sheet" onClose={() => setStatsOpen(false)}>
          {(close) => (
            <>
              <div className="sheet-head">
                <h2>{t('stats_title')}</h2>
              </div>
              <div className="stats-scroll">
                <StatsPanel members={members} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-ghost" onClick={close}>
                  {t('close')}
                </button>
              </div>
            </>
          )}
        </BottomSheet>
      )}

      <SettingsMenu
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onClosed={() => setMenuMounted(false)}
        anchorRef={settingsBtnRef}
        pushState={pushState}
        onEnablePush={handleEnablePush}
        onLeave={() => setLeaving(true)}
      />

      {toast && <div className={'toast ' + toast.kind}>{toast.msg}</div>}
    </div>
  )
}

function humanizeStartupError(err) {
  const msg = (err && err.message) || ''
  if (/anonymous/i.test(msg) || /signups?\s+not\s+allowed/i.test(msg) || /disabled/i.test(msg)) {
    return 'anon'
  }
  if (/relation .* does not exist/i.test(msg) || /schema/i.test(msg) || /not\s*find\s*the\s*table/i.test(msg)) {
    return 'schema'
  }
  return msg || 'unknown'
}

function ErrorScreen({ which }) {
  const { t } = useLang()
  const known = {
    config: { title: t('err_config_title'), body: t('err_config_body') },
    anon: { title: t('err_anon_title'), body: t('err_anon_body') },
    schema: { title: t('err_schema_title'), body: t('err_schema_body') },
  }
  const c = known[which] || {
    title: t('err_unknown_title'),
    body: typeof which === 'string' ? which : t('err_unknown_body'),
  }
  return (
    <div className="screen-center">
      <div className="error-card">
        <h1>{c.title}</h1>
        <p className="muted">{c.body}</p>
      </div>
    </div>
  )
}
