import { flushSync } from 'react-dom'
import { EASE, reducedMotion } from './motion'

const animations = new WeakMap()
function textNodes() {
  const nodes = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) {
    const node = walker.currentNode
    if (node.nodeValue.trim() && !node.parentElement.closest('script, style, textarea, [contenteditable="true"]')) nodes.push(node)
  }
  return nodes
}

// Seules les étiquettes dont le texte a réellement changé s'éclaircissent.
// Les articles saisis et le décor conservent leur rendu, sans capture de page.
export function animateCopyChange(apply) {
  if (reducedMotion()) { flushSync(apply); return }
  const before = new Map(textNodes().map((node) => [node, node.nodeValue]))
  flushSync(apply)
  const changed = new Set()
  textNodes().forEach((node) => {
    if (before.get(node) !== node.nodeValue) changed.add(node.parentElement)
  })
  changed.forEach((element) => {
    if (!element.getClientRects().length) return
    animations.get(element)?.cancel()
    const animation = element.animate([{ opacity: 0.25 }, { opacity: 1 }], { duration: 180, easing: EASE })
    animations.set(element, animation)
    animation.onfinish = () => { animations.delete(element); animation.cancel() }
  })
}
