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
    .select('id, display_name, color')
    .eq('household_id', householdId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

// --- Articles ----------------------------------------------------------------

export async function getItems(householdId) {
  const { data, error } = await supabase
    .from('items')
    .select('id, name, quantity, checked, created_at, addedBy:members(display_name, color)')
    .eq('household_id', householdId)
    .order('checked', { ascending: true })
    .order('created_at', { ascending: false }) // les plus récents en haut de la pile
  if (error) throw error
  return data ?? []
}

export async function addItem(householdId, userId, name, quantity) {
  const { error } = await supabase.from('items').insert({
    household_id: householdId,
    added_by: userId,
    name: name.trim(),
    quantity: quantity && quantity.trim() ? quantity.trim() : null,
  })
  if (error) throw error
}

export async function setItemChecked(id, checked) {
  const { error } = await supabase.from('items').update({ checked }).eq('id', id)
  if (error) throw error
}

export async function deleteItem(id) {
  const { error } = await supabase.from('items').delete().eq('id', id)
  if (error) throw error
}

// --- Historique --------------------------------------------------------------

export async function getHistory(householdId) {
  const { data, error } = await supabase
    .from('shopping_trips')
    // select('*') reste tolérant si la colonne `price` n'existe pas encore
    // (avant la migration) : l'historique se charge, le prix s'affiche « — ».
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return data ?? []
}

// Statistiques « depuis toujours » : par personne, nombre de sorties courses et
// total d'articles achetés. Agrégé côté client à partir de tout l'historique.
export async function getStats(householdId) {
  const { data, error } = await supabase
    .from('shopping_trips')
    .select('shopper_name, item_count')
    .eq('household_id', householdId)
  if (error) throw error
  const map = new Map()
  for (const t of data ?? []) {
    const s = map.get(t.shopper_name) || { name: t.shopper_name, trips: 0, items: 0 }
    s.trips += 1
    s.items += t.item_count || 0
    map.set(t.shopper_name, s)
  }
  return [...map.values()]
}

// --- Action « Je pars faire les courses » ------------------------------------

// `boughtIds` = identifiants des articles réellement achetés (cochés dans la
// fenêtre). Les autres restent dans la liste et ne sont pas archivés.
export async function goShopping(boughtIds, price) {
  const { data, error } = await supabase.functions.invoke('go-shopping', {
    body: { boughtIds, price: price ?? null },
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data // { ok, archived, kept, notified }
}

// Met à jour le prix d'une sortie (édition depuis l'historique).
export async function updateTripPrice(id, price) {
  const { error } = await supabase.from('shopping_trips').update({ price }).eq('id', id)
  if (error) throw error
}

// Supprime une sortie de l'historique (swipe dans l'historique).
// `.select()` renvoie les lignes réellement supprimées : si RLS bloque le delete,
// il n'y a ni erreur ni ligne → on lève pour que l'UI le sache (et ne reste pas
// coincée « slidée »).
export async function deleteTrip(id) {
  const { data, error } = await supabase.from('shopping_trips').delete().eq('id', id).select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new Error('not_deleted')
}
