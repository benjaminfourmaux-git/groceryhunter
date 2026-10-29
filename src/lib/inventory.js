// Ordre d'affichage de l'inventaire.
//
// Fonctions pures, sans React ni Supabase : c'est ce qui permet de les tester
// seules (src/lib/inventory.test.js) plutôt que de cliquer dans l'app.

export const SORT_RANK = 'rank' // les plus achetés d'abord
export const SORT_ALPHA = 'alpha' // ordre alphabétique

const timeOf = (p) => (p.last_bought_at ? Date.parse(p.last_bought_at) : 0)

// Accents et casse ignorés : « Œufs » se range entre « Noix » et « Pain », et
// « pates » ne part pas à la fin de la liste.
const byAlpha = (a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' })

// Score décroissant, puis achat le plus récent, puis alphabétique : l'ordre est
// totalement déterminé, donc stable d'un rendu à l'autre et testable.
const byRank = (a, b) => (b.score ?? 0) - (a.score ?? 0) || timeOf(b) - timeOf(a) || byAlpha(a, b)

export function comparatorFor(sort) {
  return sort === SORT_ALPHA ? byAlpha : byRank
}

// Les produits cochés remontent en tête ; chaque groupe reste trié selon le
// mode choisi. On ne trie jamais le tableau reçu sur place : React compare les
// références, et muter la source empêcherait le re-rendu.
export function orderProducts(products, { selected, sort = SORT_RANK } = {}) {
  const cmp = comparatorFor(sort)
  const isSelected = (p) => !!selected && selected.has(p.id)
  return [...(products ?? [])].sort(
    (a, b) => Number(isSelected(b)) - Number(isSelected(a)) || cmp(a, b)
  )
}
