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
  bell_on: 'Notifications activées',
  bell_blocked: 'Notifications bloquées',
  bell_enable: 'Activer les notifications',
  copy_code: 'Copier le code du foyer',
  copied: 'Copié !',
  lang_toggle: 'Changer de langue',
  leave: 'Quitter le foyer',
  leave_title: 'Quitter le foyer ?',
  leave_body:
    'Tu seras retiré du foyer et reviendras à l’écran de connexion. Si tu es seul·e, le foyer sera supprimé.',
  leave_confirm: 'Quitter',
  err_leave: 'Impossible de quitter le foyer.',
  stats_title: 'Classement',
  stats_items_unit: ({ n }) => (n > 1 ? 'articles' : 'article'),
  stats_empty: 'Personne n’a encore rien acheté.',

  // Liste
  add_item_ph: 'Ajouter un article…',
  qty_ph: 'Qté',
  aria_item_name: 'Article à ajouter',
  aria_qty: 'Quantité (facultatif)',
  aria_add: 'Ajouter',
  aria_check: 'Cocher',
  aria_uncheck: 'Décocher',
  aria_select: 'Sélectionner',
  aria_deselect: 'Retirer de la sélection',
  aria_delete: 'Supprimer',
  empty_title: 'La liste est vide',
  empty_body: 'Ajoute ce qui manque à la maison — tout le monde le voit aussitôt.',

  // Onglets + boutons communs
  tab_list: 'Liste',
  tab_inventory: 'Inventaire',
  cancel: 'Annuler',
  close: 'Fermer',

  // Toasts
  err_add: 'Impossible d’ajouter l’article.',
  err_action: 'Action impossible.',
  err_delete: 'Suppression impossible.',
  err_push: 'Impossible d’activer les notifications.',
  push_on: 'Notifications activées sur cet appareil.',
  push_ios_install: 'Ajoute l’app à l’écran d’accueil pour activer les notifications.',
  push_https: 'Les notifications nécessitent une connexion sécurisée (HTTPS).',
  push_unsupported: 'Les notifications ne sont pas prises en charge sur cet appareil.',

  // Inventaire
  inv_empty_title: 'Ton inventaire est vide',
  inv_empty_body:
    'Les articles que tu achètes viennent s’y ranger tout seuls, une heure après les courses.',
  inv_to_list: 'Ajouter à la liste',
  inv_delete: 'Supprimer',
  inv_delete_title: ({ n }) => (n > 1 ? `Supprimer ${n} articles ?` : 'Supprimer cet article ?'),
  inv_delete_body:
    'Ils quittent l’inventaire pour de bon. Ce qui est déjà dans la liste ne bouge pas.',
  inv_added: ({ n }) => (n > 1 ? `${n} articles ajoutés à la liste` : 'Ajouté à la liste'),
  inv_added_none: 'Déjà dans la liste',
  err_inv_add: 'Impossible d’ajouter à la liste.',
  err_inv_delete: 'Suppression impossible.',

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
  bell_on: 'Notifications on',
  bell_blocked: 'Notifications blocked',
  bell_enable: 'Enable notifications',
  copy_code: 'Copy the home code',
  copied: 'Copied!',
  lang_toggle: 'Change language',
  leave: 'Leave the home',
  leave_title: 'Leave the home?',
  leave_body:
    'You’ll be removed from the home and sent back to the sign-in screen. If you’re the only member, the home will be deleted.',
  leave_confirm: 'Leave',
  err_leave: 'Couldn’t leave the home.',
  stats_title: 'Leaderboard',
  stats_items_unit: ({ n }) => (n > 1 ? 'items' : 'item'),
  stats_empty: 'No one has bought anything yet.',

  add_item_ph: 'Add an item…',
  qty_ph: 'Qty',
  aria_item_name: 'Item to add',
  aria_qty: 'Quantity (optional)',
  aria_add: 'Add',
  aria_check: 'Check',
  aria_uncheck: 'Uncheck',
  aria_select: 'Select',
  aria_deselect: 'Deselect',
  aria_delete: 'Delete',
  empty_title: 'The list is empty',
  empty_body: 'Add what’s missing at home — everyone sees it right away.',

  tab_list: 'List',
  tab_inventory: 'Inventory',
  cancel: 'Cancel',
  close: 'Close',

  err_add: 'Couldn’t add the item.',
  err_action: 'Action failed.',
  err_delete: 'Couldn’t delete.',
  err_push: 'Couldn’t enable notifications.',
  push_on: 'Notifications enabled on this device.',
  push_ios_install: 'Add the app to your Home Screen to enable notifications.',
  push_https: 'Notifications require a secure (HTTPS) connection.',
  push_unsupported: 'Notifications aren’t supported on this device.',

  inv_empty_title: 'Your inventory is empty',
  inv_empty_body: 'Everything you buy lands here by itself, an hour after the shop.',
  inv_to_list: 'Add to list',
  inv_delete: 'Delete',
  inv_delete_title: ({ n }) => (n > 1 ? `Delete ${n} items?` : 'Delete this item?'),
  inv_delete_body: 'They leave the inventory for good. Whatever is already on the list stays put.',
  inv_added: ({ n }) => (n > 1 ? `${n} items added to the list` : 'Added to the list'),
  inv_added_none: 'Already on the list',
  err_inv_add: 'Couldn’t add to the list.',
  err_inv_delete: 'Couldn’t delete.',

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

  const langRef = useRef(lang)
  langRef.current = lang

  useEffect(() => {
    try {
      localStorage.setItem('lang', lang)
    } catch {
      /* noop */
    }
    document.documentElement.lang = lang
  }, [lang])

  // Transition fluide (View Transitions) au changement de langue.
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

  const value = useMemo(
    () => ({
      lang,
      locale: lang === 'en' ? 'en-GB' : 'fr-FR',
      toggleLang,
      t: (key, vars) => translate(lang, key, vars),
    }),
    [lang, toggleLang]
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLang() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLang doit être utilisé dans <LanguageProvider>')
  return ctx
}
