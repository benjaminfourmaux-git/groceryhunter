// Palette d'avatars (façon Tricount : ronds colorés avec initiales).
export const AVATAR_COLORS = [
  '#0E8C7F', // teal
  '#E8804C', // coral
  '#5B6CD9', // indigo
  '#C84B82', // pink
  '#3DA35D', // green
  '#D9A21B', // amber
  '#8B5CF6', // violet
  '#2BA3C7', // cyan
]

export function pickColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]
}

// Couleur stable dérivée du nom : repli quand la vraie couleur du membre est
// inconnue (ex. historique d'une personne ayant quitté le foyer).
export function hashColor(name) {
  let h = 0
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export function initials(name) {
  return (name || '?')
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
