// Remplace src/supabaseClient.js dans la démonstration : pas de client, pas de
// réseau. Le canal temps réel est un objet qui accepte .on() et .subscribe()
// sans jamais rien émettre — personne d'autre ne modifie la base ici.
export const isConfigured = true

const canal = {
  on() {
    return canal
  },
  subscribe() {
    return canal
  },
}

export const supabase = {
  channel: () => canal,
  removeChannel: () => {},
}
