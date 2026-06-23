// Aides au prix des courses (montant en euros, stocké en nombre).

// Filtre la saisie : on ne garde que les chiffres et un seul séparateur décimal
// (virgule ou point). Empêche toute lettre/symbole hors clavier numérique.
export function sanitizePriceInput(str) {
  let s = String(str ?? '').replace(/[^\d.,]/g, '')
  const sep = s.search(/[.,]/)
  if (sep !== -1) {
    s = s.slice(0, sep + 1) + s.slice(sep + 1).replace(/[.,]/g, '')
  }
  return s
}

// "23,40" ou "23.40" -> 23.4 ; vide/invalide -> null.
export function parsePrice(str) {
  if (str == null) return null
  const s = String(str).trim().replace(',', '.').replace(/[^0-9.]/g, '')
  if (s === '') return null
  const n = parseFloat(s)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null
}

// 23.4 -> "23,40 €" (selon la locale et la devise). null -> null (l'appelant affiche "—").
export function formatPrice(value, locale = 'fr-FR', currency = 'EUR') {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : parseFloat(value)
  if (!Number.isFinite(n)) return null
  try {
    // narrowSymbol => même symbole que le bouton ($, £, ¥, €) plutôt que « $US ».
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
    }).format(n)
  } catch {
    return `${n.toFixed(2)} €`
  }
}
