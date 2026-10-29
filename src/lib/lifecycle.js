import { useEffect, useState } from 'react'
import { T1_MS } from './config.js'

export function nextItemDeadline(items, now) {
  let next = Infinity
  for (const it of items) {
    if (!it.bought_at) continue
    // Seule échéance visible : à T1, l'article quitte la liste pour
    // l'inventaire (la promotion elle-même est tranchée côté serveur).
    const deadline = Date.parse(it.bought_at) + T1_MS
    if (deadline > now && deadline < next) next = deadline
  }
  return next
}

// Les changements de vue ont lieu à l'échéance, pas par un rendu global à 1 Hz.
export function useLifecycleClock(items) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    let timer
    function sync() {
      clearTimeout(timer)
      document.documentElement.toggleAttribute('data-motion-paused', document.hidden)
      if (document.hidden) return
      const time = Date.now()
      setNow(time)
      const deadline = nextItemDeadline(items, time)
      if (Number.isFinite(deadline)) timer = setTimeout(sync, Math.min(deadline - time + 5, 2147483647))
    }
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [items])
  return now
}
