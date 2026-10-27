// Démonte le rendu entre deux tests. Sans ça, les rendus s'empilent dans le
// même document et les requêtes trouvent plusieurs fois la même ligne.
// (Le nettoyage automatique de Testing Library suppose `globals: true`, qu'on
// n'active pas pour garder les imports explicites.)
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(cleanup)
