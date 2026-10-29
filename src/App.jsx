import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { supabase, isConfigured } from './supabaseClient'
import * as api from './lib/api'
import { enablePush, pushSupported, pushPermission, pushUnsupportedReason } from './lib/push'
import { initPress } from './lib/press'
import { uuid } from './lib/uuid'
import { T1_MS } from './lib/config'
import { useLang } from './lib/i18n'
import Onboarding from './components/Onboarding'
import Header from './components/Header'
import AddBar from './components/AddBar'
import ShoppingList from './components/ShoppingList'
import Inventory from './components/Inventory'
import GroupPanel from './components/GroupPanel'
import BottomSheet from './components/BottomSheet'
import Icon from './components/Icon'
import SettingsMenu from './components/SettingsMenu'
import Toast from './components/Toast'
import { useLifecycleClock } from './lib/lifecycle'
import useKeyboardDock from './lib/useKeyboardDock'
import useTabGesture from './lib/useTabGesture'

const boughtMsOf = (it) => (it.bought_at ? Date.parse(it.bought_at) : null)

export default function App() {
  const { t, lang } = useLang()
  const [phase, setPhase] = useState('loading') // loading | onboarding | ready | error
  const [errorMsg, setErrorMsg] = useState(null)
  const [member, setMember] = useState(null)
  const [members, setMembers] = useState([])
  const [items, setItems] = useState([])
  const [products, setProducts] = useState([]) // l'inventaire : un produit distinct par ligne
  // Sélection dans l'inventaire : locale et non synchronisée, pour que deux
  // membres puissent cocher en même temps sans se gêner.
  const [selected, setSelected] = useState(() => new Set())
  // Tri de l'inventaire, retenu d'une session à l'autre : un réglage qui se
  // remet à zéro à chaque lancement agace plus qu'il ne sert.
  const [invSort, setInvSort] = useState(() => {
    try {
      const saved = localStorage.getItem('invSort')
      if (saved === 'rank' || saved === 'alpha') return saved
    } catch {
      /* noop */
    }
    return 'rank'
  })
  const now = useLifecycleClock(items)
  const [view, setView] = useState('list') // list | inventory
  const [pushState, setPushState] = useState('default')
  const [leaving, setLeaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false) // suppression multiple dans l'inventaire
  const [statsOpen, setStatsOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  // Le morph Réglages est « présent » de l'ouverture jusqu'à la FIN de la
  // fermeture : on masque le bouton ⋯ tant qu'il l'est (sinon on verrait le rond
  // par défaut en double pendant la résorption).
  const [menuMounted, setMenuMounted] = useState(false)
  const [statsMounted, setStatsMounted] = useState(false)
  const [toast, setToast] = useState(null)

  const hid = member?.household_id

  const channelRef = useRef(null)
  // Après une mutation locale sur les articles, on a déjà rechargé la liste :
  // on ignore l'écho temps réel (qui arrive plus tard) pour éviter un 2e rendu.
  const skipItemsEchoUntil = useRef(0)
  const promoting = useRef(false)
  const settingsBtnRef = useRef(null) // ancre du « morph » Réglages (le bouton ⋯)
  const statsBtnRef = useRef(null)
  const mainBarRef = useRef(null)
  const tabbarRef = useRef(null)
  const indicatorRef = useRef(null)
  const viewRef = useRef(view)
  viewRef.current = view

  // Table id → membre : nom + couleur cohérents dans la liste, l'historique, les stats.
  const memberById = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m])), [members])

  // Tri uniquement quand les données changent ; l'horloge ne filtre qu'aux
  // échéances, tandis que les anneaux vivent dans la liste visible.
  const orderedItems = useMemo(() => [...items].sort((a, b) => {
    if (!!a.bought_at !== !!b.bought_at) return a.bought_at ? 1 : -1
    return a.bought_at
      ? boughtMsOf(a) - boughtMsOf(b)
      : Date.parse(b.created_at) - Date.parse(a.created_at)
  }), [items])
  const listItems = useMemo(() => orderedItems.filter((it) =>
    !it.bought_at || now - boughtMsOf(it) < T1_MS
  ), [orderedItems, now])
  const toBuyCount = useMemo(() => items.reduce((n, it) => n + (it.bought_at ? 0 : 1), 0), [items])

  const showToast = useCallback((msg, kind = 'info') => {
    setToast({ id: uuid(), msg, kind })
  }, [])

  const loadItems = useCallback(async (h) => {
    setItems(await api.getItems(h))
  }, [])
  const loadMembers = useCallback(async (h) => {
    setMembers(await api.getMembers(h))
  }, [])
  const loadProducts = useCallback(async (h) => {
    setProducts(await api.getProducts(h))
  }, [])

  const toggleSelected = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('invSort', invSort)
    } catch {
      /* noop */
    }
  }, [invSort])

  // La sélection ne survit pas au changement d'onglet.
  useEffect(() => {
    if (view !== 'inventory') setSelected((prev) => (prev.size ? new Set() : prev))
  }, [view])

  // Un produit supprimé par quelqu'un d'autre ne doit pas rester sélectionné :
  // sinon les deux boutons resteraient affichés pour une ligne disparue.
  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev
      const alive = new Set(products.map((p) => p.id))
      const next = new Set()
      prev.forEach((id) => alive.has(id) && next.add(id))
      return next.size === prev.size ? prev : next
    })
  }, [products])

  // Effet « press organique » sur tous les boutons (une seule fois).
  useEffect(() => initPress(), [])

  useKeyboardDock()
  useTabGesture(tabbarRef, indicatorRef, viewRef, setView, phase)

  // Mémorise la langue du membre côté serveur → notifications push localisées.
  useEffect(() => {
    if (member?.id) api.setMemberLang(lang)
  }, [lang, member])

  // Promotion paresseuse : une heure après l'achat, l'article quitte la liste
  // pour l'inventaire. Rien n'est écrit avant — c'est ce qui permet de décocher
  // sans laisser de trace. Réveillée par l'horloge, qui tique à l'échéance T1.
  useEffect(() => {
    if (!hid || promoting.current) return
    const hasRipe = items.some((it) => {
      const b = boughtMsOf(it)
      return b != null && now - b >= T1_MS
    })
    if (!hasRipe) return
    promoting.current = true
    skipItemsEchoUntil.current = Date.now() + 2000
    api
      .promoteBoughtItems()
      .then(() => Promise.all([loadItems(hid), loadProducts(hid)]))
      .catch(() => {})
      .finally(() => {
        promoting.current = false
      })
  }, [now, items, hid, loadItems, loadProducts])

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
    loadProducts(h)

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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products', filter: `household_id=eq.${h}` },
        () => loadProducts(h) // promotion ou suppression chez quelqu'un d'autre
      )
      .subscribe()

    channelRef.current = channel
    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [member, loadItems, loadMembers, loadProducts])

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

  // ---- Les deux actions de la sélection dans l'inventaire -------------------

  // Copie : les produits restent dans l'inventaire, et ceux qui sont déjà à
  // acheter ne sont pas ajoutés deux fois (la RPC renvoie le compte réel). On
  // ne change pas d'onglet : le bandeau et la pastille de la liste suffisent à
  // dire que c'est parti, et on peut enchaîner plusieurs lots.
  async function handleAddSelectedToList() {
    const ids = [...selected]
    if (ids.length === 0) return
    setSelected(new Set())
    try {
      skipItemsEchoUntil.current = Date.now() + 1500
      const n = await api.addProductsToList(ids)
      await loadItems(hid)
      showToast(n > 0 ? t('inv_added', { n }) : t('inv_added_none'), n > 0 ? 'success' : 'info')
    } catch (err) {
      showToast(err.message || t('err_inv_add'), 'error')
    }
  }

  // Un seul produit part sans confirmation (la ligne disparaît sous le doigt,
  // c'est lisible) ; au-delà, on demande — effacer vingt produits par mégarde
  // ne se rattrape pas.
  function askDeleteSelected() {
    if (selected.size > 1) setConfirmDelete(true)
    else handleDeleteSelected()
  }

  async function handleDeleteSelected() {
    const ids = [...selected]
    if (ids.length === 0) return
    setConfirmDelete(false)
    setSelected(new Set())
    try {
      await api.deleteProducts(ids)
      await loadProducts(hid)
    } catch (err) {
      showToast(err.message || t('err_inv_delete'), 'error')
    }
  }

  // ---- Actions liste --------------------------------------------------------

  // Quantité modifiable après coup : les articles repris de l'inventaire
  // arrivent sans quantité, et c'est dans la liste qu'on la règle.
  async function handleSetQuantity(id, raw) {
    const q = raw && raw.trim() ? raw.trim() : null
    const before = items.find((it) => it.id === id)?.quantity ?? null
    if (q === before) return // rien à écrire : le champ a été ouvert puis refermé
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, quantity: q } : it)))
    try {
      skipItemsEchoUntil.current = Date.now() + 1500
      await api.setItemQuantity(id, q)
    } catch (err) {
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, quantity: before } : it)))
      showToast(err.message || t('err_action'), 'error')
    }
  }

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
    setSettingsOpen(false)
    setStatsMounted(true)
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
        onShowStats={handleShowStats}
        onOpenSettings={() => { setStatsOpen(false); setMenuMounted(true); setSettingsOpen(true) }}
        hideSettingsBtn={menuMounted}
        settingsBtnRef={settingsBtnRef}
        hideStatsBtn={statsMounted}
        statsBtnRef={statsBtnRef}
      />

      <div className="content-stack">
        <main id="list-panel" role="tabpanel" aria-labelledby="list-tab"
          className="content has-cta" data-active={view === 'list'} aria-hidden={view !== 'list'}
          inert={view !== 'list' ? '' : undefined}>
          <ShoppingList items={listItems} now={now} memberById={memberById}
            onToggleBought={handleToggleBought} onDelete={handleDelete}
            onSetQuantity={handleSetQuantity} active={view === 'list'} />
        </main>
        <main id="inventory-panel" role="tabpanel" aria-labelledby="inventory-tab"
          className="content" data-active={view === 'inventory'} aria-hidden={view !== 'inventory'}
          inert={view !== 'inventory' ? '' : undefined}>
          <Inventory products={products} memberById={memberById} selected={selected}
            onToggleSelected={toggleSelected} sort={invSort} onSortChange={setInvSort}
            active={view === 'inventory'} />
        </main>
      </div>

      <div className="dock">
        <Meadow />
        <div className="dock-ground" ref={mainBarRef}>
          <div className="add-slot" data-active={view === 'list'} inert={view !== 'list' ? '' : undefined} aria-hidden={view !== 'list'}>
            <div className="add-slot-inner"><AddBar onAdd={handleAdd} /></div>
          </div>

          {/* Mêmes mécaniques que la barre d'ajout : le créneau se replie quand
              rien n'est coché, donc les onglets ne sautent pas. */}
          <div className="add-slot" data-active={view === 'inventory' && selected.size > 0}
            inert={view === 'inventory' && selected.size > 0 ? undefined : ''}
            aria-hidden={!(view === 'inventory' && selected.size > 0)}>
            <div className="add-slot-inner">
              <div className="inv-actions">
                <button type="button" className="btn-primary" onClick={handleAddSelectedToList}>
                  <Icon name="plus" size={18} />
                  {t('inv_to_list')}
                </button>
                <button type="button" className="btn-danger" onClick={askDeleteSelected}>
                  <Icon name="trash" size={18} />
                  {t('inv_delete')}
                </button>
              </div>
            </div>
          </div>

          <nav className="tabbar" role="tablist" aria-label={t('tab_list') + ' / ' + t('tab_inventory')} data-active={view} ref={tabbarRef}>
            <span className="tab-indicator" aria-hidden="true" ref={indicatorRef} />
            <button
              type="button"
              id="list-tab" role="tab" aria-selected={view === 'list'} aria-controls="list-panel"
              className={'tab' + (view === 'list' ? ' active' : '')}
              onClick={() => setView('list')}
            >
              <Icon name="list" size={19} />
              <span>{t('tab_list')}</span>
              {toBuyCount > 0 && <span className="tab-badge">{toBuyCount}</span>}
            </button>
            <button
              type="button"
              id="inventory-tab" role="tab" aria-selected={view === 'inventory'} aria-controls="inventory-panel"
              className={'tab' + (view === 'inventory' ? ' active' : '')}
              onClick={() => setView('inventory')}
            >
              <Icon name="inventory" size={19} />
              <span>{t('tab_inventory')}</span>
            </button>
          </nav>
        </div>
      </div>

      {confirmDelete && (
        <BottomSheet className="confirm" onClose={() => setConfirmDelete(false)}>
          {(close) => (
            <>
              <h2>{t('inv_delete_title', { n: selected.size })}</h2>
              <p className="muted">{t('inv_delete_body')}</p>
              <div className="modal-actions">
                <button type="button" className="btn-ghost" onClick={close}>
                  {t('cancel')}
                </button>
                <button type="button" className="btn-danger" onClick={handleDeleteSelected}>
                  {t('inv_delete')}
                </button>
              </div>
            </>
          )}
        </BottomSheet>
      )}

      {leaving && (
        <BottomSheet className="confirm" onClose={() => setLeaving(false)}>
          {(close) => (
            <>
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

      <GroupPanel open={statsOpen} onClose={() => setStatsOpen(false)}
        onClosed={() => setStatsMounted(false)} anchorRef={statsBtnRef}
        dockRef={mainBarRef} members={members} />

      <SettingsMenu
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onClosed={() => setMenuMounted(false)}
        anchorRef={settingsBtnRef}
        dockRef={mainBarRef}
        onLeave={() => setLeaving(true)}
      />

      {toast && <Toast key={toast.id} message={toast.msg} kind={toast.kind} onDismiss={() => setToast((current) => current?.id === toast.id ? null : current)} />}
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

// Prairie fleurie peinte au-dessus du dock (décor « Grand ciel »).
function Meadow() {
  return (
    <svg className="meadow" viewBox="0 0 390 62" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <path className="meadow-back" d="M0 26C70 10 148 36 228 22c54-9 110-12 162-4v48H0V26Z" />
      <path className="meadow-front" d="M0 42C92 30 170 52 260 40c48-6 92-6 130 0v22H0V42Z" />
      <circle cx="48" cy="34" r="3.4" fill="#D6513C" />
      <circle cx="96" cy="40" r="2.6" fill="#E8B23C" />
      <circle cx="150" cy="44" r="3" fill="#FDFBF5" />
      <circle cx="206" cy="33" r="3.4" fill="#D6513C" />
      <circle cx="262" cy="39" r="2.6" fill="#E8B23C" />
      <circle cx="318" cy="31" r="3" fill="#FDFBF5" />
      <circle cx="358" cy="38" r="3.4" fill="#D6513C" />
    </svg>
  )
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
