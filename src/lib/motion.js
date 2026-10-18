import { useEffect, useState } from 'react'

export const MOTION_QUERY = '(prefers-reduced-motion: reduce)'
export const EXIT_MS = 220
export const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
export function reducedMotion() {
  return !!window.matchMedia?.(MOTION_QUERY).matches
}
export function useReducedMotion() {
  const [reduced, setReduced] = useState(reducedMotion)
  useEffect(() => {
    const media = window.matchMedia(MOTION_QUERY)
    const update = () => setReduced(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return reduced
}
