import { useEffect } from 'react'

export default function useKeyboardDock() {
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const root = document.documentElement
    let raf = 0
    let lastKb = 0
    let wasOpen = false
    let motionEnd = 0
    let lastLift = -1
    const inBar = (el) => !!el?.closest?.('.add-bar')
    function apply(kb) {
      const ground = document.querySelector('.dock-ground')
      const bar = document.querySelector('.add-bar')
      const under = ground && bar ? ground.offsetHeight - (bar.offsetTop + bar.offsetHeight) : 0
      const lift = kb > 0 ? Math.max(0, kb + 8 - under) : 0
      root.style.setProperty('--keyboard-height', `${kb}px`)
      // Une échéance commune au geste du clavier : chaque resize ne relance
      // plus 420 ms de retard derrière le doigt/viewport.
      root.style.setProperty('--kb-duration', `${Math.max(0, Math.min(280, motionEnd - performance.now()))}ms`)
      if (Math.abs(lift - lastLift) > 0.5) {
        root.style.setProperty('--kb-lift', `${lift}px`)
        lastLift = lift
      }
    }
    function sync() {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        root.style.setProperty('--vv-top', `${vv.offsetTop}px`)
        const overlap = Math.max(0, Math.round(root.clientHeight - vv.height))
        const editing = inBar(document.activeElement)
        const kb = overlap > 80 && (editing || wasOpen) ? overlap : 0
        // Certaines versions d'iOS ne notifient qu'à la FIN de l'ouverture.
        // Garder alors un petit déplacement plutôt qu'un saut instantané.
        if ((kb > 0) !== wasOpen && performance.now() >= motionEnd) {
          motionEnd = performance.now() + (kb > 0 ? 160 : 140)
        }
        if (kb > 0) lastKb = kb
        wasOpen = kb > 0
        apply(kb)
        if (!kb && !editing && window.scrollY) window.scrollTo(0, 0)
      })
    }
    function focusIn(e) {
      if (!inBar(e.target)) return
      motionEnd = performance.now() + 280
      if (lastKb) apply(lastKb)
    }
    function focusOut(e) {
      if (!inBar(e.target) || inBar(e.relatedTarget)) return
      motionEnd = performance.now() + 240
      // La barre accompagne la fermeture réelle au lieu de tomber sous le clavier.
      if (!wasOpen) apply(0)
    }
    vv.addEventListener('resize', sync)
    vv.addEventListener('scroll', sync)
    window.addEventListener('resize', sync)
    document.addEventListener('focusin', focusIn)
    document.addEventListener('focusout', focusOut)
    sync()
    return () => {
      cancelAnimationFrame(raf)
      vv.removeEventListener('resize', sync)
      vv.removeEventListener('scroll', sync)
      window.removeEventListener('resize', sync)
      document.removeEventListener('focusin', focusIn)
      document.removeEventListener('focusout', focusOut)
      for (const name of ['--kb-lift', '--kb-duration', '--keyboard-height']) root.style.removeProperty(name)
    }
  }, [])
}
