import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LanguageProvider } from '../lib/i18n'
import ShoppingList from './ShoppingList'

const article = (over = {}) => ({
  id: 'lait',
  name: 'Lait',
  quantity: null,
  bought_at: null,
  bought_by: null,
  added_by: 'cam',
  created_at: '2026-10-27T08:00:00Z',
  ...over,
})

function monter(items, props = {}) {
  const onSetQuantity = props.onSetQuantity ?? vi.fn()
  render(
    <LanguageProvider>
      <ShoppingList
        items={items}
        now={Date.parse('2026-10-27T09:00:00Z')}
        memberById={{ cam: { display_name: 'Camille', color: '#0E8C7F' } }}
        onToggleBought={vi.fn()}
        onDelete={vi.fn()}
        {...props}
        onSetQuantity={onSetQuantity}
      />
    </LanguageProvider>
  )
  return { onSetQuantity }
}

const champQte = () => screen.queryByRole('textbox', { name: 'Quantité (facultatif)' })

describe('ShoppingList — quantité modifiable', () => {
  it('ouvre un champ vide depuis le nom quand l’article n’a pas de quantité', async () => {
    monter([article()])
    expect(champQte()).toBeNull()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Modifier la quantité de Lait' }))
    expect(champQte()).toBeTruthy()
    expect(champQte().value).toBe('')
  })

  it('ouvre le champ pré-rempli depuis la pastille', async () => {
    monter([article({ quantity: 'x2' })])
    await userEvent.setup().click(screen.getByRole('button', { name: 'x2' }))
    expect(champQte().value).toBe('x2')
  })

  // La ligne transmet la saisie telle quelle ; c'est App qui coupe les espaces
  // et traduit le vide en null, au même endroit que le repli optimiste.
  it('transmet la saisie à la validation', async () => {
    const { onSetQuantity } = monter([article()])
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Modifier la quantité de Lait' }))
    await user.type(champQte(), '  500 g  ')
    await user.keyboard('{Enter}')
    expect(onSetQuantity).toHaveBeenCalledWith('lait', '  500 g  ')
    expect(champQte()).toBeNull() // le champ se referme
  })

  it('n’enregistre rien quand on annule avec Échap', async () => {
    const { onSetQuantity } = monter([article({ quantity: 'x2' })])
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'x2' }))
    await user.clear(champQte())
    await user.keyboard('{Escape}')
    expect(onSetQuantity).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'x2' })).toBeTruthy() // la pastille revient
  })

  it('enregistre aussi quand on touche ailleurs', async () => {
    const { onSetQuantity } = monter([article()])
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Modifier la quantité de Lait' }))
    await user.type(champQte(), '3')
    champQte().blur()
    expect(onSetQuantity).toHaveBeenCalledWith('lait', '3')
  })

  it('montre un indice « + Qté » qui ouvre le champ quand il n’y a pas de quantité', async () => {
    monter([article()])
    const indice = document.querySelector('.qty-hint')
    expect(indice?.textContent).toBe('Qté')
    // Réservé au doigt : le nom porte déjà le libellé accessible.
    expect(indice.getAttribute('aria-hidden')).toBe('true')
    expect(indice.tabIndex).toBe(-1)
    await userEvent.setup().click(indice)
    expect(champQte()).toBeTruthy()
    expect(document.querySelector('.qty-hint')).toBeNull()
  })

  it('remplace l’indice par la pastille quand la quantité existe', () => {
    monter([article({ quantity: 'x2' })])
    expect(document.querySelector('.qty-hint')).toBeNull()
    expect(screen.getByRole('button', { name: 'x2' })).toBeTruthy()
  })

  it('ne propose pas l’indice sur un article déjà acheté', () => {
    monter([article({ bought_at: '2026-10-27T08:30:00Z', bought_by: 'cam' })])
    const indice = document.querySelector('.qty-hint')
    expect(!indice || indice.disabled).toBe(true)
  })

  it('n’ouvre rien sur un article déjà acheté : il est en partance', () => {
    monter([article({ bought_at: '2026-10-27T08:30:00Z', bought_by: 'cam' })])
    expect(screen.getByRole('button', { name: 'Modifier la quantité de Lait' })).toHaveProperty(
      'disabled',
      true
    )
  })
})
