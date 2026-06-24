// Courbe = var(--ease), mais en LITTÉRAL : `var()` dans une chaîne `transition`
// posée en JS (inline) ne se parse pas sur Safari mobile → transition invalide,
// donc changement instantané et durées ignorées. En dur, ça marche partout.
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
const DUR_HEIGHT = 0.4 // s
const DUR_OPACITY = 0.3 // s — un peu plus court : transparent avant la fin du repli

// Sortie fluide d'une ligne de swipe (liste ET historique).
// Après le glissement, on replie la ligne : hauteur + opacité → 0. Le `gap` du
// conteneur flex est compensé par une marge négative pour que les voisines
// remontent sans à-coup. `onDone` est appelé quand le repli est terminé.
export function collapseRow(row, onDone) {
  const gap = parseFloat(getComputedStyle(row.parentElement).rowGap) || 0
  const h = row.offsetHeight

  // Couper l'animation d'entrée `item-in` : appliquée avec `both`, elle fige
  // opacity:1 et écraserait notre opacity:0 inline (une anim CSS l'emporte sur
  // l'inline) → la bordure/ombre resterait visible à hauteur 0. On la neutralise.
  row.style.animation = 'none'
  row.style.height = h + 'px'
  row.style.overflow = 'hidden'
  void row.offsetHeight // reflow : la transition part de la hauteur figée

  row.style.transition =
    `height ${DUR_HEIGHT}s ${EASE}, opacity ${DUR_OPACITY}s ${EASE}, margin ${DUR_HEIGHT}s ${EASE}`
  row.style.height = '0px'
  row.style.opacity = '0'
  // Pas de marge négative sur la dernière ligne (aucune voisine à remonter).
  if (gap && row.nextElementSibling) row.style.marginBottom = `-${gap}px`

  let done = false
  const end = (e) => {
    if (e && e.propertyName && e.propertyName !== 'height') return // attend la hauteur
    if (done) return
    done = true
    row.removeEventListener('transitionend', end)
    onDone()
  }
  row.addEventListener('transitionend', end)
  setTimeout(end, DUR_HEIGHT * 1000 + 120) // filet de sécurité si transitionend ne tire pas
}

// Annule un repli/glissement en cours (échec de suppression) : on remet les
// styles inline à zéro pour que la ligne revienne à son état normal.
export function resetRow(row, fg) {
  row.style.transition = ''
  row.style.height = ''
  row.style.opacity = ''
  row.style.marginBottom = ''
  row.style.overflow = ''
  row.removeAttribute('data-armed')
  if (fg) fg.style.transform = ''
}
