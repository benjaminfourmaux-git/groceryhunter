// Cycle de vie d'un article coché « acheté » :
//   coché → reste dans la liste (compte à rebours) pendant T1 → part dans
//   l'historique pendant T2 → suppression définitive.
//
// VALEURS DE TEST (courtes) pour valider le fonctionnement rapidement.
// Pour la prod, remplacer par :
//   export const T1_MS = 60 * 60 * 1000        // 1 h
//   export const T2_MS = 48 * 60 * 60 * 1000   // 48 h
export const T1_MS = 10 * 1000 // délai avant qu'un article acheté quitte la liste → historique
export const T2_MS = 20 * 1000 // rétention dans l'historique avant suppression définitive
