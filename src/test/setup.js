// Démonte le rendu entre deux tests. Sans ça, les rendus s'empilent dans le
// même document et les requêtes trouvent plusieurs fois la même ligne.
// (Le nettoyage automatique de Testing Library suppose `globals: true`, qu'on
// n'active pas pour garder les imports explicites.)
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(cleanup)

// jsdom n'expose pas matchMedia. Les composants s'en servent pour respecter
// « mouvements réduits » : on répond donc comme un navigateur qui ne les réduit
// pas, afin de tester le comportement par défaut.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query) => ({
    media: query,
    matches: false,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })
}
