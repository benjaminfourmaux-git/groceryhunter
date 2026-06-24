import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { supabase, isConfigured } from './supabaseClient'
import * as api from './lib/api'
import { enablePush, pushSupported, pushPermission } from './lib/push'
import { initPress } from './lib/press'
import { parsePrice, sanitizePriceInput } from './lib/price'
import { uuid } from './lib/uuid'
import { useLang, useCurrency } from './lib/i18n'
import Onboarding from './components/Onboarding'
import Header from './components/Header'
import ShoppingList from './components/ShoppingList'
import History from './components/History'
import StatsPanel from './components/StatsPanel'
import Icon from './components/Icon'
import SettingsMenu from './components/SettingsMenu'

export default function App() {
  const { t, lang } = useLang()
  const { currencySymbol } = useCurrency()
  const [phase, setPhase] = useState('loading') // loading | onboarding | ready | error
  const [errorMsg, setErrorMsg] = useState(null)
  const [member, setMember] = useState(null)
  const [members, setMembers] = useState([])
  const [items, setItems] = useState([])
  const [trips, setTrips] = useState([])
  const [view, setView] = useState('list') // list | history
  const [pushState, setPushState] = useState('default')
  const [goBusy, setGoBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [bought, setBought] = useState(() => new Set())
  const [price, setPrice] = useState('')
  const [leaving, setLeaving] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)
  const [stats, setStats] = useState([])
  const [settingsOpen, setSettingsOpen] = useState(false)
  // Le morph Réglages est « présent » de l'ouverture jusqu'à la FIN de la
  // fermeture : on masque le bouton ⋯ tant qu'il l'est (sinon on verrait le rond
  // par défaut en double pendant la résorption).
  const [menuMounted, setMenuMounted] = useState(false)
  const [toast, setToast] = useState(null)

  const channelRef = useRef(null)
  // Après une mutation locale sur les articles, on a déjà rechargé la liste :
  // on ignore l'écho temps réel (qui arrive plus tard) pour éviter un 2e rendu
  // qui rejoue l'animation d'entrée (« rebond joué deux fois »).
  const skipItemsEchoUntil = useRef(0)
  const settingsBtnRef = useRef(null) // ancre du « morph » Réglages (le bouton ⋯)
  const tabbarRef = useRef(null)
  const indicatorRef = useRef(null)
  const viewRef = useRef(view)
  viewRef.current = view

  // Table nom → couleur réelle des membres : garantit qu'une même personne
  // garde la même couleur d'avatar dans la liste, l'historique et les stats.
  const memberColors = useMemo(
    () => Object.fromEntries(members.map((m) => [m.display_name, m.color])),
    [members]
  )

  // Effet « press organique » sur tous les boutons (une seule fois).
  useEffect(() => initPress(), [])

  // Mémorise la langue du membre côté serveur → notifications push localisées.
  useEffect(() => {
    if (member?.id) api.setMemberLang(lang)
  }, [lang, member])

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

      // Aimant : on anime jusqu'à la cible (transition CSS), puis on rend la main.
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

  const showToast = useCallback((msg, kind = 'info') => {
    setToast({ msg, kind })
    setTimeout(() => setToast(null), 3200)
  }, [])

  // ---- Chargements ----------------------------------------------------------
  const loadItems = useCallback(async (hid) => {
    setItems(await api.getItems(hid))
  }, [])
  const loadMembers = useCallback(async (hid) => {
    setMembers(await api.getMembers(hid))
  }, [])
  const loadHistory = useCallback(async (hid) => {
    setTrips(await api.getHistory(hid))
  }, [])

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
    const hid = member.household_id

    loadItems(hid)
    loadMembers(hid)
    loadHistory(hid)

    // Push : refléter l'état et ré-enregistrer l'abonnement si déjà autorisé.
    if (!pushSupported()) {
      setPushState('unsupported')
    } else {
      setPushState(pushPermission())
      if (pushPermission() === 'granted') {
        enablePush(member).catch(() => {})
      }
    }

    // Abonnement temps réel : on rafraîchit la vue concernée à chaque changement.
    const channel = supabase
      .channel(`household-${hid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'items', filter: `household_id=eq.${hid}` },
        () => {
          if (Date.now() < skipItemsEchoUntil.current) return // écho de notre propre mutation
          loadItems(hid)
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shopping_trips', filter: `household_id=eq.${hid}` },
        () => {
          // Une nouvelle sortie = la liste vient d'être vidée côté serveur.
          // On recharge AUSSI les articles : l'événement DELETE en masse ne
          // traverse pas toujours le filtre temps réel (clé seule dans le
          // payload), donc on s'appuie sur l'INSERT (fiable) pour resynchroniser
          // la liste de tout le monde en même temps.
          loadHistory(hid)
          loadItems(hid)
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'members', filter: `household_id=eq.${hid}` },
        () => loadMembers(hid)
      )
      .subscribe()

    channelRef.current = channel
    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [member, loadItems, loadMembers, loadHistory])

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
  const hid = member?.household_id

  async function handleAdd(name, qty) {
    // Optimistic UI : on affiche l'article AVANT la confirmation serveur. On
    // génère l'uuid côté client et on le réutilise comme id en base → même clé
    // partout, donc pas de remontage ni de double animation à la réconciliation.
    const id = uuid()
    const trimmedQty = qty && qty.trim() ? qty.trim() : null
    const optimistic = {
      id,
      name: name.trim(),
      quantity: trimmedQty,
      checked: false,
      created_at: new Date().toISOString(),
      addedBy: { display_name: member.display_name, color: member.color },
    }
    // En haut : cohérent avec le tri serveur (non cochés, plus récents d'abord).
    setItems((prev) => [optimistic, ...prev])

    try {
      skipItemsEchoUntil.current = Date.now() + 1500
      await api.addItem(hid, member.id, name, qty, id)
      // Pas de loadItems : la ligne est déjà à l'écran avec le bon id. L'écho
      // temps réel est ignoré (skipItemsEchoUntil) ; les autres appareils, eux,
      // reçoivent l'INSERT et se synchronisent normalement.
    } catch (err) {
      setItems((prev) => prev.filter((it) => it.id !== id)) // rollback
      showToast(err.message || t('err_add'), 'error')
    }
  }
  async function handleDelete(id) {
    try {
      skipItemsEchoUntil.current = Date.now() + 1500
      await api.deleteItem(id)
      await loadItems(hid)
    } catch (err) {
      showToast(err.message || t('err_delete'), 'error')
      throw err // laisse le SwipeRow annuler le repli/glissement
    }
  }
  async function handleGoShopping(boughtIds, tripPrice) {
    setConfirming(false)
    setGoBusy(true)
    try {
      const res = await api.goShopping(boughtIds, tripPrice)
      await Promise.all([loadItems(hid), loadHistory(hid)])
      const archived = res?.archived ?? 0
      const kept = res?.kept ?? 0
      const notified = res?.notified ?? 0
      if (archived === 0) {
        showToast(t('toast_nothing'), 'info')
      } else {
        showToast(t('toast_done', { archived, kept, notified }), 'success')
      }
    } catch (err) {
      showToast(err.message || t('err_action'), 'error')
    } finally {
      setGoBusy(false)
    }
  }
  async function handleEnablePush() {
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
      setTrips([])
      setMembers([])
      setView('list')
      setPhase('onboarding')
    } catch (err) {
      showToast(err.message || t('err_leave'), 'error')
    }
  }

  async function handleShowStats() {
    setStatsOpen(true)
    try {
      setStats(await api.getStats(hid))
    } catch {
      setStats([])
    }
  }

  async function handleUpdatePrice(id, newPrice) {
    try {
      await api.updateTripPrice(id, newPrice)
      await loadHistory(hid)
    } catch (err) {
      showToast(err.message || t('err_action'), 'error')
    }
  }
  async function handleDeleteTrip(id) {
    try {
      await api.deleteTrip(id)
      await loadHistory(hid)
    } catch (err) {
      showToast(err.message === 'not_deleted' ? t('err_delete') : err.message || t('err_delete'), 'error')
      throw err // laisse le SwipeTrip annuler le glissement
    }
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

  const remaining = items.filter((i) => !i.checked).length

  // ---- Fenêtre « J'ai fait les courses » ------------------------------------
  function openConfirm() {
    setBought(new Set(items.map((i) => i.id))) // tout coché par défaut
    setPrice('')
    setConfirming(true)
  }
  function toggleBought(id) {
    setBought((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const boughtCount = items.reduce((n, i) => n + (bought.has(i.id) ? 1 : 0), 0)
  const allBought = items.length > 0 && boughtCount === items.length
  const keptCount = items.length - boughtCount
  function confirmGo() {
    handleGoShopping(
      items.filter((i) => bought.has(i.id)).map((i) => i.id),
      parsePrice(price)
    )
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
          <ShoppingList items={items} onAdd={handleAdd} onDelete={handleDelete} />
        ) : (
          <History
            trips={trips}
            onUpdatePrice={handleUpdatePrice}
            onDelete={handleDeleteTrip}
            colorByName={memberColors}
          />
        )}
      </main>

      <div className="dock">
        {view === 'list' && (
          <div className="cta-wrap">
            <button
              type="button"
              className="go-btn"
              onClick={openConfirm}
              disabled={goBusy || items.length === 0}
            >
              <Icon name="cart" size={21} />
              <span>{goBusy ? t('saving') : t('did_shopping')}</span>
            </button>
          </div>
        )}

        <nav className="tabbar" data-active={view} ref={tabbarRef}>
          <span className="tab-indicator" aria-hidden="true" ref={indicatorRef} />
          <button
            type="button"
            className={'tab' + (view === 'list' ? ' active' : '')}
            onClick={() => setView('list')}
          >
            <span className="tab-icon">
              <Icon name="list" size={22} />
              {remaining > 0 && <span className="tab-badge">{remaining}</span>}
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

      {confirming && (
        <div className="modal-overlay" onClick={() => setConfirming(false)}>
          <div className="modal sheet" onClick={(e) => e.stopPropagation()}>
            <span className="modal-grip" aria-hidden="true" />
            <div className="sheet-head">
              <h2>{t('did_shopping')}</h2>
              <p className="muted">
                {allBought ? t('sheet_hint_all') : t('sheet_hint_partial', { n: keptCount })}
              </p>
            </div>

            <ul className="confirm-list">
              {items.map((it) => {
                const on = bought.has(it.id)
                return (
                  <li
                    key={it.id}
                    className={'confirm-item' + (on ? ' on' : '')}
                    onClick={() => toggleBought(it.id)}
                  >
                    <span className="checkbox" aria-hidden="true">
                      {on && <Icon name="check" size={15} strokeWidth={3} />}
                    </span>
                    <span className="confirm-name">{it.name}</span>
                    {it.quantity && <span className="qty-badge">{it.quantity}</span>}
                  </li>
                )
              })}
            </ul>

            <label className="price-field">
              <span className="price-field-label">
                {t('price_label')} <em className="optional">{t('optional')}</em>
              </span>
              <span className="price-input-wrap">
                <input
                  className="price-input"
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => setPrice(sanitizePriceInput(e.target.value))}
                  placeholder={t('price_ph')}
                  maxLength={10}
                />
                <span className="price-cur">{currencySymbol}</span>
              </span>
            </label>

            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={() => setConfirming(false)}>
                {t('cancel')}
              </button>
              <button type="button" className="btn-primary" onClick={confirmGo} disabled={goBusy}>
                {goBusy ? t('saving') : allBought ? t('confirm_all') : t('confirm_partial')}
              </button>
            </div>
          </div>
        </div>
      )}

      {leaving && (
        <div className="modal-overlay" onClick={() => setLeaving(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <span className="modal-grip" aria-hidden="true" />
            <span className="modal-emoji danger" aria-hidden="true">
              <Icon name="logout" size={24} />
            </span>
            <h2>{t('leave_title')}</h2>
            <p className="muted">{t('leave_body')}</p>
            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={() => setLeaving(false)}>
                {t('cancel')}
              </button>
              <button type="button" className="btn-danger" onClick={handleLeave}>
                {t('leave_confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {statsOpen && (
        <div className="modal-overlay" onClick={() => setStatsOpen(false)}>
          <div className="modal sheet" onClick={(e) => e.stopPropagation()}>
            <span className="modal-grip" aria-hidden="true" />
            <div className="sheet-head">
              <h2>{t('stats_title')}</h2>
            </div>
            <div className="stats-scroll">
              <StatsPanel stats={stats} colorByName={memberColors} />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={() => setStatsOpen(false)}>
                {t('close')}
              </button>
            </div>
          </div>
        </div>
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
