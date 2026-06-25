// ============================================================================
//  i18n maison (sans dépendance). FR ⇄ EN.
//  - dictionnaires fr/en (valeur = chaîne, ou fonction(vars) pour les pluriels)
//  - persistance localStorage
//  - bascule « seamless » via l'API View Transitions (fondu enchaîné des mots)
//  Seules les chaînes de l'UI sont traduites ; le contenu saisi ne l'est pas.
// ============================================================================

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { flushSync } from 'react-dom'

const fr = {
  // Onboarding
  app_name: 'Liste de courses',
  tagline: 'La liste commune de la maison, synchronisée sur tous les téléphones.',
  tab_create: 'Créer un foyer',
  tab_join: 'Rejoindre',
  first_name: 'Ton prénom',
  first_name_ph: 'Ex. Camille',
  home_name: 'Nom du foyer',
  optional: '(facultatif)',
  home_name_ph: 'Ex. Maison',
  home_code: 'Code du foyer',
  home_code_ph: 'Ex. K7M2QP',
  create_cta: 'Créer mon foyer',
  join_cta: 'Rejoindre le foyer',
  busy: 'Un instant…',
  hint_create: 'Tu obtiendras un code à partager avec les autres.',
  hint_join: 'Demande le code à quelqu’un déjà dans le foyer.',
  err_first_name: 'Indique ton prénom.',
  err_code: 'Indique le code du foyer.',
  err_generic: 'Une erreur est survenue.',

  // Header / Réglages
  settings_title: 'Réglages',
  settings_notifications: 'Notifications',
  settings_language: 'Langue',
  settings_currency: 'Devise',
  bell_on: 'Notifications activées',
  bell_blocked: 'Notifications bloquées',
  bell_enable: 'Activer les notifications',
  copy_code: 'Copier le code du foyer',
  copied: 'Copié !',
  lang_toggle: 'Changer de langue',
  currency_toggle: 'Changer de devise',
  members_aria: 'Membres du foyer',
  leave: 'Quitter le foyer',
  leave_title: 'Quitter le foyer ?',
  leave_body:
    'Tu seras retiré du foyer et reviendras à l’écran de connexion. Si tu es seul·e, le foyer sera supprimé.',
  leave_confirm: 'Quitter',
  err_leave: 'Impossible de quitter le foyer.',
  stats_title: 'Classement',
  stats_trips_unit: ({ n }) => (n > 1 ? 'courses' : 'course'),
  stats_empty: 'Personne n’a encore fait les courses.',

  // Liste
  add_item_ph: 'Ajouter un article…',
  qty_ph: 'Qté',
  aria_item_name: 'Nom de l’article',
  aria_qty: 'Quantité (facultatif)',
  aria_add: 'Ajouter',
  aria_check: 'Cocher',
  aria_uncheck: 'Décocher',
  aria_delete: 'Supprimer',
  empty_title: 'La liste est vide',
  empty_body: 'Ajoute ce qui manque à la maison — tout le monde le voit aussitôt.',

  // CTA + feuille « J'ai fait les courses »
  did_shopping: 'J’ai fait les courses',
  saving: 'Enregistrement…',
  tab_list: 'Liste',
  tab_history: 'Historique',
  sheet_hint_all: 'Décoche ce que tu n’as pas trouvé : ça restera dans la liste.',
  sheet_hint_partial: ({ n }) => `${n} article${n > 1 ? 's' : ''} gardé${n > 1 ? 's' : ''} dans la liste.`,
  cancel: 'Annuler',
  close: 'Fermer',
  price_label: 'Prix des courses',
  price_ph: '0,00',
  edit_price: 'Modifier le prix',
  confirm_all: 'Courses complétées',
  confirm_partial: 'Courses partielles',

  // Toasts
  toast_nothing: 'Rien d’acheté — la liste ne bouge pas.',
  toast_done: ({ archived, kept, notified }) => {
    let m = `Courses faites · ${archived} acheté${archived > 1 ? 's' : ''}`
    if (kept > 0) m += ` · ${kept} gardé${kept > 1 ? 's' : ''}`
    if (notified > 0) m += ` · ${notified} prévenu${notified > 1 ? 's' : ''}`
    return m
  },
  err_add: 'Impossible d’ajouter l’article.',
  err_action: 'Action impossible.',
  err_delete: 'Suppression impossible.',
  err_push: 'Impossible d’activer les notifications.',
  push_on: 'Notifications activées sur cet appareil.',
  push_ios_install: 'Ajoute l’app à l’écran d’accueil pour activer les notifications.',
  push_https: 'Les notifications nécessitent une connexion sécurisée (HTTPS).',
  push_unsupported: 'Les notifications ne sont pas prises en charge sur cet appareil.',

  // Historique
  hist_empty_title: 'Pas encore de courses faites',
  hist_empty_body: 'Tes virées au supermarché apparaîtront ici.',
  today_at: ({ time }) => `Aujourd’hui à ${time}`,
  yesterday_at: ({ time }) => `Hier à ${time}`,
  items_count: ({ n }) => `${n} article${n > 1 ? 's' : ''}`,

  // Écrans d'erreur
  err_config_title: 'Configuration manquante',
  err_config_body:
    'Copiez le fichier .env.example en .env, renseignez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY, puis relancez.',
  err_anon_title: 'Connexions anonymes désactivées',
  err_anon_body:
    'Dans Supabase : Authentication → Sign In / Providers → activez « Anonymous sign-ins », puis rechargez.',
  err_schema_title: 'Base non initialisée',
  err_schema_body: 'Exécutez le fichier supabase/schema.sql dans le SQL Editor de Supabase, puis rechargez.',
  err_unknown_title: 'Une erreur est survenue',
  err_unknown_body: 'Réessayez dans un instant.',
}

const en = {
  app_name: 'Shopping list',
  tagline: 'Your home’s shared list, synced across every phone.',
  tab_create: 'Create a home',
  tab_join: 'Join',
  first_name: 'Your first name',
  first_name_ph: 'e.g. Alex',
  home_name: 'Home name',
  optional: '(optional)',
  home_name_ph: 'e.g. Home',
  home_code: 'Home code',
  home_code_ph: 'e.g. K7M2QP',
  create_cta: 'Create my home',
  join_cta: 'Join the home',
  busy: 'One moment…',
  hint_create: 'You’ll get a code to share with the others.',
  hint_join: 'Ask someone already in the home for the code.',
  err_first_name: 'Enter your first name.',
  err_code: 'Enter the home code.',
  err_generic: 'Something went wrong.',

  settings_title: 'Settings',
  settings_notifications: 'Notifications',
  settings_language: 'Language',
  settings_currency: 'Currency',
  bell_on: 'Notifications on',
  bell_blocked: 'Notifications blocked',
  bell_enable: 'Enable notifications',
  copy_code: 'Copy the home code',
  copied: 'Copied!',
  lang_toggle: 'Change language',
  currency_toggle: 'Change currency',
  members_aria: 'Home members',
  leave: 'Leave the home',
  leave_title: 'Leave the home?',
  leave_body:
    'You’ll be removed from the home and sent back to the sign-in screen. If you’re the only member, the home will be deleted.',
  leave_confirm: 'Leave',
  err_leave: 'Couldn’t leave the home.',
  stats_title: 'Leaderboard',
  stats_trips_unit: ({ n }) => (n > 1 ? 'trips' : 'trip'),
  stats_empty: 'No one has done the shopping yet.',

  add_item_ph: 'Add an item…',
  qty_ph: 'Qty',
  aria_item_name: 'Item name',
  aria_qty: 'Quantity (optional)',
  aria_add: 'Add',
  aria_check: 'Check',
  aria_uncheck: 'Uncheck',
  aria_delete: 'Delete',
  empty_title: 'The list is empty',
  empty_body: 'Add what’s missing at home — everyone sees it right away.',

  did_shopping: 'I did the shopping',
  saving: 'Saving…',
  tab_list: 'List',
  tab_history: 'History',
  sheet_hint_all: 'Uncheck anything you couldn’t find — it’ll stay on the list.',
  sheet_hint_partial: ({ n }) => `${n} item${n > 1 ? 's' : ''} kept on the list.`,
  cancel: 'Cancel',
  close: 'Close',
  price_label: 'Shopping cost',
  price_ph: '0.00',
  edit_price: 'Edit price',
  confirm_all: 'Shopping done',
  confirm_partial: 'Partial shopping',

  toast_nothing: 'Nothing bought — the list stays put.',
  toast_done: ({ archived, kept, notified }) => {
    let m = `Shopping done · ${archived} bought`
    if (kept > 0) m += ` · ${kept} kept`
    if (notified > 0) m += ` · ${notified} notified`
    return m
  },
  err_add: 'Couldn’t add the item.',
  err_action: 'Action failed.',
  err_delete: 'Couldn’t delete.',
  err_push: 'Couldn’t enable notifications.',
  push_on: 'Notifications enabled on this device.',
  push_ios_install: 'Add the app to your Home Screen to enable notifications.',
  push_https: 'Notifications require a secure (HTTPS) connection.',
  push_unsupported: 'Notifications aren’t supported on this device.',

  hist_empty_title: 'No shopping yet',
  hist_empty_body: 'Your “shopping done” trips will show up here.',
  today_at: ({ time }) => `Today at ${time}`,
  yesterday_at: ({ time }) => `Yesterday at ${time}`,
  items_count: ({ n }) => `${n} item${n > 1 ? 's' : ''}`,

  err_config_title: 'Missing configuration',
  err_config_body:
    'Copy .env.example to .env, fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart.',
  err_anon_title: 'Anonymous sign-ins disabled',
  err_anon_body:
    'In Supabase: Authentication → Sign In / Providers → enable “Anonymous sign-ins”, then reload.',
  err_schema_title: 'Database not initialised',
  err_schema_body: 'Run supabase/schema.sql in the Supabase SQL Editor, then reload.',
  err_unknown_title: 'Something went wrong',
  err_unknown_body: 'Try again in a moment.',
}

const dictionaries = { fr, en }

// Devises proposées (réglage d'UI, comme la langue — pas de conversion).
const CURRENCIES = ['EUR', 'USD', 'GBP', 'JPY']
const CURRENCY_SYMBOL = { EUR: '€', USD: '$', GBP: '£', JPY: '¥' }

function translate(lang, key, vars) {
  const dict = dictionaries[lang] || fr
  const value = dict[key]
  if (value == null) return key
  return typeof value === 'function' ? value(vars || {}) : value
}

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try {
      const saved = localStorage.getItem('lang')
      if (saved === 'fr' || saved === 'en') return saved
    } catch {
      /* noop */
    }
    return 'fr'
  })

  const [currency, setCurrency] = useState(() => {
    try {
      const saved = localStorage.getItem('currency')
      if (CURRENCIES.includes(saved)) return saved
    } catch {
      /* noop */
    }
    return 'EUR'
  })

  const langRef = useRef(lang)
  langRef.current = lang
  const currencyRef = useRef(currency)
  currencyRef.current = currency

  useEffect(() => {
    try {
      localStorage.setItem('lang', lang)
    } catch {
      /* noop */
    }
    document.documentElement.lang = lang
  }, [lang])

  useEffect(() => {
    try {
      localStorage.setItem('currency', currency)
    } catch {
      /* noop */
    }
  }, [currency])

  // Transition fluide partagée (View Transitions) pour langue et devise.
  const animate = useCallback((apply) => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (typeof document !== 'undefined' && document.startViewTransition && !reduce) {
      document.startViewTransition(() => flushSync(apply))
    } else {
      apply()
    }
  }, [])

  const toggleLang = useCallback(() => {
    const next = langRef.current === 'fr' ? 'en' : 'fr'
    animate(() => setLang(next))
  }, [animate])

  // Devise suivante dans le cycle €, $, £, ¥.
  const cycleCurrency = useCallback(() => {
    const i = CURRENCIES.indexOf(currencyRef.current)
    const next = CURRENCIES[(i + 1) % CURRENCIES.length]
    animate(() => setCurrency(next))
  }, [animate])

  const value = useMemo(
    () => ({
      lang,
      locale: lang === 'en' ? 'en-GB' : 'fr-FR',
      toggleLang,
      t: (key, vars) => translate(lang, key, vars),
      currency,
      currencySymbol: CURRENCY_SYMBOL[currency],
      cycleCurrency,
    }),
    [lang, toggleLang, currency, cycleCurrency]
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLang() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLang doit être utilisé dans <LanguageProvider>')
  return ctx
}

export function useCurrency() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useCurrency doit être utilisé dans <LanguageProvider>')
  return { currency: ctx.currency, currencySymbol: ctx.currencySymbol, cycleCurrency: ctx.cycleCurrency }
}
