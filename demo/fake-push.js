// Les notifications demandent un service worker et une vraie clé VAPID :
// hors sujet dans un artefact. L'app sait gérer « non pris en charge ».
export function pushSupported() {
  return false
}
export function pushPermission() {
  return 'unsupported'
}
export function pushUnsupportedReason() {
  return 'push_unsupported'
}
export async function enablePush() {}
export async function disablePush() {}
export async function isPushEnabled() {
  return false
}
