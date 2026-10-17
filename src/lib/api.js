import { supabase } from '../supabaseClient'

// --- Identité / foyer --------------------------------------------------------

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

// Connexion anonyme (un utilisateur par appareil, sans mot de passe).
export async function ensureAnonymousSession() {
  const { data } = await supabase.auth.getSession()
  if (data.session) return data.session
  const { data: signed, error } = await supabase.auth.signInAnonymously()
  if (error) throw error
  return signed.session
}

// Le membre courant + son foyer, ou null s'il n'a pas encore rejoint de foyer.
export async function getMyMember() {
  // On filtre explicitement sur l'utilisateur courant : sinon, dès qu'un foyer
  // compte plusieurs membres, la requête renverrait plusieurs lignes et
  // échouerait (« multiple rows returned »).
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const uid = session?.user?.id
  if (!uid) return null

  const { data, error } = await supabase
    .from('members')
    .select('id, household_id, display_name, color, household:households(id, name, join_code)')
    .eq('id', uid)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createHousehold(name, displayName, color) {
  const { data, error } = await supabase.rpc('create_household', {
    p_name: name,
    p_display_name: displayName,
    p_color: color,
  })
  if (error) throw error
  return data // { member, household }
}

export async function joinHousehold(code, displayName, color) {
  const { data, error } = await supabase.rpc('join_household', {
    p_code: code,
    p_display_name: displayName,
    p_color: color,
  })
  if (error) throw error
  return data // { member, household }
}

// Quitter le foyer : supprime le membre. Si plus personne, le foyer est supprimé
// (logique côté serveur dans la RPC, qui contourne RLS en SECURITY DEFINER).
export async function leaveHousehold() {
  const { error } = await supabase.rpc('leave_household')
  if (error) throw error
}

// Préférence de langue du membre, pour que les notifications push soient
// envoyées dans la bonne langue à chacun.
export async function setMemberLang(lang) {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const uid = session?.user?.id
  if (!uid) return
  await supabase.from('members').update({ lang }).eq('id', uid)
}

// --- Membres -----------------------------------------------------------------

export async function getMembers(householdId) {
  const { data, error } = await supabase
    .from('members')
    .select('id, display_name, color, purchases_count')
    .eq('household_id', householdId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

// --- Articles ----------------------------------------------------------------

// On renvoie added_by / bought_by en simples uuid : le client résout le membre
// (nom + couleur) via la liste des membres déjà chargée. Évite les jointures
// ambiguës (deux FK items → members) et garde une couleur d'avatar cohérente.
export async function getItems(householdId) {
  const { data, error } = await supabase
    .from('items')
    .select('id, name, quantity, bought_at, bought_by, added_by, created_at')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

// `id` est fourni par le client (uuid) pour l'« optimistic UI » : la ligne
// affichée tout de suite et la ligne en base partagent la même clé, donc aucun
// remontage ni double animation à la réconciliation. Absent → le défaut SQL
// (gen_random_uuid) prend le relais.
// `createdAt` (facultatif) : même horodatage que la ligne optimiste, pour que
// l'écho serveur ne change pas l'ordre de la liste (pas de sursaut).
export async function addItem(householdId, userId, name, quantity, id, createdAt) {
  const { error } = await supabase.from('items').insert({
    ...(id ? { id } : {}),
    ...(createdAt ? { created_at: createdAt } : {}),
    household_id: householdId,
    added_by: userId,
    name: name.trim(),
    quantity: quantity && quantity.trim() ? quantity.trim() : null,
  })
  if (error) throw error
}

// Coche / décoche un article (« acheté »). La RPC pose bought_at + bought_by et
// ajuste le compteur permanent du membre de façon atomique.
export async function setItemBought(id, bought) {
  const { error } = await supabase.rpc('set_item_bought', { p_item_id: id, p_bought: bought })
  if (error) throw error
}

export async function deleteItem(id) {
  const { error } = await supabase.from('items').delete().eq('id', id)
  if (error) throw error
}

// Nettoyage paresseux : supprime les articles achetés depuis plus de T1+T2
// (expirés de l'historique). Appelé par le client à l'ouverture / au fil du temps.
export async function cleanupExpired(householdId, cutoffIso) {
  const { error } = await supabase
    .from('items')
    .delete()
    .eq('household_id', householdId)
    .lt('bought_at', cutoffIso)
  if (error) throw error
}

// L'historique n'a plus de table dédiée : il est dérivé des `items` achetés
// (bought_at entre T1 et T1+T2) côté client. L'ancien flux « sorties »
// (shopping_trips, go-shopping, prix) est retiré.
