// Copie texte robuste. `navigator.clipboard` n'existe qu'en contexte sécurisé
// (HTTPS / localhost) : en HTTP (dev sur le réseau), il est absent. On retombe
// alors sur execCommand via un <textarea> temporaire — compatible iOS Safari
// (sélection par Range + setSelectionRange). Renvoie true si la copie a réussi.
export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // on tente le repli ci-dessous
  }
  return legacyCopy(text)
}

function legacyCopy(text) {
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.readOnly = true
    ta.contentEditable = 'true'
    ta.style.position = 'fixed'
    ta.style.top = '0'
    ta.style.left = '0'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    const range = document.createRange()
    range.selectNodeContents(ta)
    const sel = window.getSelection()
    sel.removeAllRanges()
    sel.addRange(range)
    ta.setSelectionRange(0, text.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}
