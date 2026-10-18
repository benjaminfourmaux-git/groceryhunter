import { EASE, EXIT_MS, reducedMotion } from './motion'

const exits = new WeakMap()

// Hauteur et espace se replient ensemble ; le rendu optimiste et la requête
// n'attendent pas la fin de l'animation. Renvoie une fonction d'arrêt.
export function collapseRow(row, onDone = () => {}) {
  exits.get(row)?.()
  if (reducedMotion()) {
    onDone()
    return () => {}
  }
  const gap = parseFloat(getComputedStyle(row.parentElement).rowGap) || 0
  const height = row.offsetHeight
  row.style.animation = 'none'
  row.style.height = height + 'px'
  row.style.overflow = 'hidden'
  void row.offsetHeight
  row.style.transition = `height ${EXIT_MS}ms ${EASE}, opacity 160ms ${EASE}, margin ${EXIT_MS}ms ${EASE}, padding ${EXIT_MS}ms ${EASE}`
  row.style.height = '0px'
  row.style.paddingTop = '0px'
  row.style.paddingBottom = '0px'
  row.style.opacity = '0'
  if (gap && row.nextElementSibling) row.style.marginBottom = `-${gap}px`
  let finished = false
  let timer
  function cancel() {
    row.removeEventListener('transitionend', end)
    clearTimeout(timer)
    exits.delete(row)
  }
  function end(e) {
    if (e && (e.target !== row || e.propertyName !== 'height')) return
    if (finished) return
    finished = true
    cancel()
    onDone()
  }
  row.addEventListener('transitionend', end)
  timer = setTimeout(end, EXIT_MS + 80)
  exits.set(row, cancel)
  return cancel
}

export function resetRow(row, fg) {
  exits.get(row)?.()
  for (const prop of ['transition', 'height', 'paddingTop', 'paddingBottom', 'opacity', 'marginBottom', 'overflow', 'animation']) row.style[prop] = ''
  row.removeAttribute('data-armed')
  if (fg) {
    fg.style.transition = ''
    fg.style.transform = ''
  }
}
