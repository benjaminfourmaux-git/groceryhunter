// Cycle de vie d'un article coché « acheté » :
//   coché → reste dans la liste pendant T1 (compte à rebours, pour qu'un
//   décochage ne laisse aucune trace) → promu dans l'inventaire (table
//   `products`) et retiré de la liste.
//
// T1 pilote ici l'affichage : l'anneau de compte à rebours et la partition
// liste / inventaire. Le délai qui FAIT FOI pour la promotion est celui de
// `promote_bought_items` (supabase/schema.sql) — les deux doivent rester
// d'accord, et c'est le serveur qui tranche.
//
// Pour tester rapidement, mettre T1 à 10 s ici ET dans la RPC.
export const T1_MS = 60 * 60 * 1000 // 1 h
