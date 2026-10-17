// Palette d'avatars « Grand ciel » : quatre teintes de paysage, chacune avec sa
// variante crépuscule (variables CSS --av-<teinte>). On stocke en base la valeur
// claire ; l'affichage passe par la teinte, pour suivre le thème.
export const AVATAR_TONES = {
  prairie: '#3E7A46',
  coquelicot: '#B33A28',
  lac: '#3D6E82',
  lavande: '#7A5A96',
}
export const AVATAR_COLORS = Object.values(AVATAR_TONES)

// Anciennes couleurs (palette d'avant « Grand ciel »), encore en base pour les
// membres existants : rattachées à la teinte la plus proche.
const LEGACY_TONES = {
  '#0e8c7f': 'lac', // teal
  '#e8804c': 'coquelicot', // coral
  '#5b6cd9': 'lavande', // indigo
  '#c84b82': 'coquelicot', // pink
  '#3da35d': 'prairie', // green
  '#d9a21b': 'prairie', // amber
  '#8b5cf6': 'lavande', // violet
  '#2ba3c7': 'lac', // cyan
}

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

// Teinte d'affichage d'une couleur stockée (nouvelle, ancienne ou inconnue).
export function avatarTone(color) {
  const c = (color || '').toLowerCase()
  for (const [tone, hex] of Object.entries(AVATAR_TONES)) if (hex.toLowerCase() === c) return tone
  if (LEGACY_TONES[c]) return LEGACY_TONES[c]
  const names = Object.keys(AVATAR_TONES)
  let h = 0
  for (let i = 0; i < c.length; i++) h = (h * 31 + c.charCodeAt(i)) >>> 0
  return names[h % names.length]
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
