import { useLayoutEffect, useRef, useState } from 'react'
import { EXIT_MS, useReducedMotion } from './motion'

// Garde brièvement les lignes retirées pour replier leur place. Une réponse
// serveur qui restaure l'article annule sa sortie, sans recréer sa ligne.
export default function usePresenceItems(items, active = true) {
  const reduced = useReducedMotion()
  const [present, setPresent] = useState(() => items.map((it) => ({ it, exiting: false })))
  const current = useRef(present)
  const timers = useRef(new Map())
  useLayoutEffect(() => {
    const ids = new Set(items.map((it) => it.id))
    const next = items.map((it) => ({ it, exiting: false }))
    timers.current.forEach((timer, id) => {
      if (ids.has(id) || !active || reduced) {
        clearTimeout(timer)
        timers.current.delete(id)
      }
    })
    if (active && !reduced) {
      current.current.forEach(({ it }, index) => {
        if (ids.has(it.id)) return
        next.splice(Math.min(index, next.length), 0, { it, exiting: true })
        if (!timers.current.has(it.id)) {
          timers.current.set(it.id, setTimeout(() => {
            timers.current.delete(it.id)
            current.current = current.current.filter((entry) => entry.it.id !== it.id)
            setPresent(current.current)
          }, EXIT_MS))
        }
      })
    }
    current.current = next
    setPresent(next)
  }, [items, active, reduced])
  useLayoutEffect(() => () => {
    timers.current.forEach(clearTimeout)
    timers.current.clear()
  }, [])
  return present
}
