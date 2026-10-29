import { test } from 'vitest'
import assert from 'node:assert/strict'
import { nextItemDeadline } from './lifecycle.js'
import { T1_MS } from './config.js'

const bought = Date.parse('2026-10-17T10:00:00Z')
const item = { bought_at: new Date(bought).toISOString() }
test('sans achat, aucun réveil périodique de toute l’application', () => {
  assert.equal(nextItemDeadline([{ bought_at: null }], bought), Infinity)
})
test('échéance T1, sans boucle à la frontière exacte', () => {
  assert.equal(nextItemDeadline([item], bought), bought + T1_MS)
  assert.equal(nextItemDeadline([item], bought + T1_MS), Infinity)
})
test('plusieurs achats : le premier changement visible réveille l’écran', () => {
  const older = { bought_at: new Date(bought - T1_MS + 1500).toISOString() }
  const future = { bought_at: new Date(bought + 1000).toISOString() }
  assert.equal(nextItemDeadline([future, item, older], bought), bought + 1500)
})
test('données invalides ou expirées : pas de minuteur négatif', () => {
  assert.equal(nextItemDeadline([item, { bought_at: 'invalid' }], bought + T1_MS + 1), Infinity)
})
