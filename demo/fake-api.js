// ============================================================================
//  Faux serveur, en mémoire — pour la démonstration publiée en artefact.
//
//  Il remplace src/lib/api.js au moment de la compilation (voir vite.config.js
//  de ce dossier) : aucun réseau, aucun identifiant, rien à installer. Les
//  règles sont celles du vrai schéma SQL, réécrites en JavaScript :
//    · un article promu une heure (ici 8 s) après l'achat, pas avant ;
//    · un produit distinct par nom normalisé, accents et casse ignorés ;
//    · le même score de frécence, demi-vie de 60 jours ;
//    · « Ajouter à la liste » copie, sans doublonner ce qui est déjà à acheter.
//
//  Ce qu'il NE prouve pas : les RPC PostgreSQL elles-mêmes (c'est le rôle de
//  supabase/tests), ni la synchronisation entre deux téléphones.
// ============================================================================
import { T1_MS } from '../src/lib/config'

const DEMI_VIE_MS = 60 * 24 * 60 * 60 * 1000
const LATENCE_MS = 70 // de quoi voir l'affichage optimiste faire son travail

const uuid = () => crypto.randomUUID()
const attendre = () => new Promise((r) => setTimeout(r, LATENCE_MS))
const ilYA = (ms) => new Date(Date.now() - ms).toISOString()

// Miroir de public.product_key : minuscules, sans accent, espaces resserrés.
export const cleProduit = (nom) =>
  (nom ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')

const MOI = '11111111-1111-1111-1111-111111111111'

const base = {
  foyer: { id: 'foyer-demo', name: 'Maison', join_code: 'K7M2QP' },
  membres: [
    { id: MOI, display_name: 'Camille', color: '#0E8C7F', purchases_count: 41 },
    { id: 'ben', display_name: 'Ben', color: '#5B6CD9', purchases_count: 38 },
    { id: 'lea', display_name: 'Léa', color: '#C84B82', purchases_count: 9 },
  ],
  articles: [
    { nom: 'Lait demi-écrémé', qte: 'x2', par: MOI },
    { nom: 'Pain de campagne', qte: null, par: 'ben' },
    { nom: 'Tomates grappe', qte: '500 g', par: MOI },
    { nom: 'Café moulu', qte: null, par: 'lea' },
  ].map((a, i) => ({
    id: uuid(),
    household_id: 'foyer-demo',
    name: a.nom,
    quantity: a.qte,
    bought_at: null,
    bought_by: null,
    added_by: a.par,
    created_at: ilYA((i + 1) * 60000),
  })),
  // L'inventaire tel qu'il serait après quelques semaines d'usage : des scores
  // variés, pour que les deux tris ne donnent pas le même ordre.
  produits: [
    { nom: 'Lait demi-écrémé', score: 6.2, jours: 2, par: MOI },
    { nom: 'Pain de campagne', score: 5.8, jours: 1, par: 'ben' },
    { nom: 'Œufs', score: 3.4, jours: 5, par: MOI },
    { nom: 'Bananes', score: 3.1, jours: 4, par: 'lea' },
    { nom: 'Pâtes', score: 2.2, jours: 12, par: 'ben' },
    { nom: 'Papier toilette', score: 1.9, jours: 9, par: MOI },
    { nom: 'Café moulu', score: 1.4, jours: 21, par: 'lea' },
    { nom: 'Éponges', score: 0.8, jours: 48, par: 'ben' },
  ].map((p) => ({
    id: uuid(),
    household_id: 'foyer-demo',
    name: p.nom,
    name_key: cleProduit(p.nom),
    score: p.score,
    last_bought_at: ilYA(p.jours * 24 * 60 * 60 * 1000),
    last_bought_by: p.par,
  })),
}

let db = structuredClone(base)

export function reinitialiser() {
  db = structuredClone(base)
}

// --- Identité / foyer --------------------------------------------------------

export async function ensureAnonymousSession() {
  await attendre()
  return { user: { id: MOI } }
}

export async function getMyMember() {
  await attendre()
  const moi = db.membres.find((m) => m.id === MOI)
  return { ...moi, household_id: db.foyer.id, household: db.foyer }
}

export async function createHousehold() {
  await attendre()
}
export async function joinHousehold() {
  await attendre()
}
export async function leaveHousehold() {
  await attendre()
}
export async function setMemberLang() {}

export async function getMembers() {
  await attendre()
  return db.membres.map((m) => ({ ...m }))
}

// --- Articles ----------------------------------------------------------------

export async function getItems() {
  await attendre()
  return db.articles
    .map((a) => ({ ...a }))
    .sort((x, y) => Date.parse(y.created_at) - Date.parse(x.created_at))
}

export async function addItem(householdId, userId, name, quantity, id, createdAt) {
  await attendre()
  db.articles.push({
    id: id ?? uuid(),
    household_id: db.foyer.id,
    name: name.trim(),
    quantity: quantity && quantity.trim() ? quantity.trim() : null,
    bought_at: null,
    bought_by: null,
    added_by: userId,
    created_at: createdAt ?? new Date().toISOString(),
  })
}

export async function setItemBought(id, bought) {
  await attendre()
  const a = db.articles.find((x) => x.id === id)
  if (!a) return
  const membre = db.membres.find((m) => m.id === MOI)
  if (bought && !a.bought_at) {
    a.bought_at = new Date().toISOString()
    a.bought_by = MOI
    membre.purchases_count += 1
  } else if (!bought && a.bought_at) {
    a.bought_at = null
    a.bought_by = null
    membre.purchases_count = Math.max(0, membre.purchases_count - 1)
  }
}

export async function setItemQuantity(id, quantity) {
  await attendre()
  const q = quantity && quantity.trim() ? quantity.trim() : null
  const a = db.articles.find((x) => x.id === id)
  if (a) a.quantity = q
  return q
}

export async function deleteItem(id) {
  await attendre()
  db.articles = db.articles.filter((a) => a.id !== id)
}

// --- Inventaire --------------------------------------------------------------

export async function getProducts() {
  await attendre()
  return db.produits
    .map((p) => ({ ...p }))
    .sort((x, y) => y.score - x.score || x.name.localeCompare(y.name, 'fr'))
}

// Miroir de promote_bought_items : du plus ancien achat au plus récent, pour
// que la décroissance du score s'applique dans l'ordre.
export async function promoteBoughtItems() {
  const murs = db.articles
    .filter((a) => a.bought_at && Date.now() - Date.parse(a.bought_at) >= T1_MS)
    .sort((x, y) => Date.parse(x.bought_at) - Date.parse(y.bought_at))
  if (murs.length === 0) return
  await attendre()

  for (const a of murs) {
    const cle = cleProduit(a.name)
    const existant = db.produits.find((p) => p.name_key === cle)
    if (existant) {
      const precedent = existant.last_bought_at ? Date.parse(existant.last_bought_at) : Date.parse(a.bought_at)
      const ecart = Math.max(0, Date.parse(a.bought_at) - precedent)
      existant.score = existant.score * Math.pow(0.5, ecart / DEMI_VIE_MS) + 1
      if (Date.parse(a.bought_at) >= precedent) {
        existant.last_bought_at = a.bought_at
        existant.last_bought_by = a.bought_by
      }
      // Le nom n'est pas réécrit : l'orthographe d'origine reste celle du produit.
    } else {
      db.produits.push({
        id: uuid(),
        household_id: db.foyer.id,
        name: a.name.trim(),
        name_key: cle,
        score: 1,
        last_bought_at: a.bought_at,
        last_bought_by: a.bought_by,
      })
    }
    db.articles = db.articles.filter((x) => x.id !== a.id)
  }
}

export async function addProductsToList(productIds) {
  await attendre()
  const aAcheter = new Set(
    db.articles.filter((a) => !a.bought_at).map((a) => cleProduit(a.name))
  )
  let n = 0
  for (const id of productIds) {
    const p = db.produits.find((x) => x.id === id)
    if (!p || aAcheter.has(p.name_key)) continue
    db.articles.push({
      id: uuid(),
      household_id: db.foyer.id,
      name: p.name,
      quantity: null, // l'inventaire ne retient pas la quantité : elle se règle dans la liste
      bought_at: null,
      bought_by: null,
      added_by: MOI,
      created_at: new Date().toISOString(),
    })
    aAcheter.add(p.name_key)
    n += 1
  }
  return n
}

export async function deleteProducts(productIds) {
  await attendre()
  const aSupprimer = new Set(productIds)
  db.produits = db.produits.filter((p) => !aSupprimer.has(p.id))
}

export async function getSession() {
  return { user: { id: MOI } }
}
