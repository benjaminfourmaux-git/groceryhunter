// Cycle de vie d'un article coché « acheté » :
//   coché → reste dans la liste (compte à rebours) pendant T1 → part dans
//   l'historique pendant T2 → suppression définitive.
//
// Pour tester rapidement, mettre par exemple T1 = 10 s et T2 = 20 s.
export const T1_MS = 60 * 60 * 1000 // 1 h : délai avant qu'un article acheté quitte la liste → historique
export const T2_MS = 48 * 60 * 60 * 1000 // 48 h : rétention dans l'historique avant suppression définitive
