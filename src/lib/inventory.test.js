import { describe, expect, it } from 'vitest'
import { orderProducts, SORT_ALPHA, SORT_RANK } from './inventory'

const p = (name, score, daysAgo) => ({
  id: name.toLowerCase(),
  name,
  score,
  last_bought_at: daysAgo == null ? null : new Date(Date.now() - daysAgo * 86400000).toISOString(),
})

const names = (list) => list.map((x) => x.name)

describe('orderProducts', () => {
  const stock = [p('Pain', 2.1, 3), p('Lait', 5.4, 1), p('Œufs', 2.1, 10), p('Café', 0.9, 40)]

  it('classe par score décroissant', () => {
    expect(names(orderProducts(stock, { sort: SORT_RANK }))).toEqual([
      'Lait',
      'Pain',
      'Œufs',
      'Café',
    ])
  })

  it('départage deux scores égaux par l’achat le plus récent', () => {
    // Pain et Œufs sont à 2,1 : Pain a été acheté il y a 3 jours, Œufs il y a 10.
    const ordered = names(orderProducts(stock, { sort: SORT_RANK }))
    expect(ordered.indexOf('Pain')).toBeLessThan(ordered.indexOf('Œufs'))
  })

  it('trie alphabétiquement sans se faire piéger par les accents', () => {
    expect(names(orderProducts(stock, { sort: SORT_ALPHA }))).toEqual([
      'Café',
      'Lait',
      'Œufs',
      'Pain',
    ])
  })

  it('remonte les produits cochés en tête', () => {
    const selected = new Set(['café', 'œufs'])
    expect(names(orderProducts(stock, { selected, sort: SORT_RANK }))).toEqual([
      'Œufs', // les deux cochés d'abord, entre eux dans l'ordre du tri
      'Café',
      'Lait',
      'Pain',
    ])
  })

  it('garde le tri alphabétique à l’intérieur de la sélection', () => {
    const selected = new Set(['pain', 'café'])
    expect(names(orderProducts(stock, { selected, sort: SORT_ALPHA }))).toEqual([
      'Café',
      'Pain',
      'Lait',
      'Œufs',
    ])
  })

  it('ne modifie pas le tableau reçu', () => {
    const before = names(stock)
    orderProducts(stock, { selected: new Set(['café']), sort: SORT_ALPHA })
    expect(names(stock)).toEqual(before)
  })

  it('supporte une liste vide ou absente', () => {
    expect(orderProducts([])).toEqual([])
    expect(orderProducts(undefined)).toEqual([])
  })

  it('range un produit sans date après celui qui en a une, à score égal', () => {
    const jamais = p('Sel', 2.1, null)
    const ordered = names(orderProducts([jamais, p('Pain', 2.1, 3)], { sort: SORT_RANK }))
    expect(ordered).toEqual(['Pain', 'Sel'])
  })
})
