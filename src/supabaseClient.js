import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isConfigured = Boolean(url && anon)

if (!isConfigured) {
  // Aide au démarrage : visible dans la console du navigateur.
  console.warn(
    'Supabase non configuré. Copiez .env.example en .env et renseignez ' +
      'VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.'
  )
}

export const supabase = createClient(url ?? 'http://localhost', anon ?? 'public-anon-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
})
