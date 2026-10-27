import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LanguageProvider } from '../lib/i18n'
import Inventory from './Inventory'

const PRODUITS = [
  { id: 'lait', name: 'Lait', score: 5.4, last_bought_at: '2026-10-26T09:00:00Z', last_bought_by: 'cam' },
  { id: 'pain', name: 'Pain', score: 2.1, last_bought_at: '2026-10-24T09:00:00Z', last_bought_by: 'ben' },
  { id: 'cafe', name: 'Café', score: 0.9, last_bought_at: '2026-09-18T09:00:00Z', last_bought_by: 'cam' },
]

const MEMBRES = {
  cam: { display_name: 'Camille', color: '#0E8C7F' },
  ben: { display_name: 'Ben', color: '#5B6CD9' },
}

function monter(props = {}) {
  const onToggleSelected = props.onToggleSelected ?? vi.fn()
  const utils = render(
    <LanguageProvider>
      <Inventory
        products={PRODUITS}
        memberById={MEMBRES}
        selected={new Set()}
        sort="rank"
        {...props}
        onToggleSelected={onToggleSelected}
      />
    </LanguageProvider>
  )
  return { ...utils, onToggleSelected }
}

// Le nom seul : la ligne contient aussi l'initiale de l'avatar.
const lignes = () =>
  screen.getAllByRole('listitem').map((li) => li.querySelector('.item-name').textContent)

describe('Inventory', () => {
  it('affiche un produit par ligne, sans date', () => {
    monter()
    expect(lignes()).toEqual(['Lait', 'Pain', 'Café'])
    expect(screen.queryByText(/\d{1,2}:\d{2}/)).toBeNull()
  })

  it('remonte les produits cochés en tête', () => {
    monter({ selected: new Set(['cafe']) })
    expect(lignes()).toEqual(['Café', 'Lait', 'Pain'])
  })

  it('marque la ligne cochée, pour la CSS comme pour les lecteurs d’écran', () => {
    monter({ selected: new Set(['pain']) })
    const pain = screen
      .getAllByRole('listitem')
      .find((li) => li.querySelector('.item-name').textContent === 'Pain')
    expect(pain.className).toContain('selected')
    expect(screen.getByRole('button', { name: 'Retirer de la sélection' })).toHaveProperty(
      'ariaPressed',
      'true'
    )
  })

  it('remonte l’identifiant du produit quand on coche', async () => {
    const { onToggleSelected } = monter()
    const user = userEvent.setup()
    const cases = screen.getAllByRole('button', { name: 'Sélectionner' })
    await user.click(cases[1]) // la 2e ligne affichée, donc « Pain »
    expect(onToggleSelected).toHaveBeenCalledWith('pain')
  })

  it('n’affiche ni liste ni case quand l’inventaire est vide', () => {
    monter({ products: [] })
    expect(screen.queryByRole('list')).toBeNull()
    expect(screen.getByText('Ton inventaire est vide')).toBeTruthy()
  })

  it('suit le tri alphabétique quand il est demandé', () => {
    monter({ sort: 'alpha' })
    expect(lignes()).toEqual(['Café', 'Lait', 'Pain'])
  })
})
