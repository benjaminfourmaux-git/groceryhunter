import { supabase } from '../supabaseClient'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

export function pushSupported() {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export function pushPermission() {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission // 'default' | 'granted' | 'denied'
}

// Détaille POURQUOI le push est indisponible, pour afficher un message
// actionnable plutôt qu'un « pas pris en charge » sans issue. Renvoie null si OK.
export function pushUnsupportedReason() {
  // HTTP hors localhost : service worker & push ne sont même pas exposés.
  if (typeof window !== 'undefined' && window.isSecureContext === false) return 'insecure'
  if (pushSupported()) return null
  // iOS n'expose les API de notifications QUE dans une PWA installée (écran
  // d'accueil) — jamais dans l'onglet Safari.
  const ua = navigator.userAgent || ''
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true
  if (iOS && !standalone) return 'ios-install'
  return 'unsupported'
}

// Indique si CE navigateur est déjà abonné.
export async function isPushEnabled() {
  if (!pushSupported()) return false
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  return Boolean(sub)
}

// Demande la permission, s'abonne, et enregistre l'abonnement côté Supabase.
export async function enablePush(member) {
  if (!pushSupported()) {
    throw new Error("Les notifications ne sont pas prises en charge sur cet appareil.")
  }
  if (!VAPID_PUBLIC_KEY) {
    throw new Error('Clé VAPID publique manquante (VITE_VAPID_PUBLIC_KEY).')
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Notifications refusées dans le navigateur.')
  }

  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      member_id: member.id,
      household_id: member.household_id,
      endpoint: sub.endpoint,
      subscription: sub.toJSON(),
    },
    { onConflict: 'endpoint' }
  )
  if (error) throw error

  return sub
}
