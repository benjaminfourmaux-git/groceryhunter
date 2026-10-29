import { useEffect, useState } from 'react'
import { useReducedMotion } from '../lib/motion'

export default function Toast({ message, kind, onDismiss }) {
  const [closing, setClosing] = useState(false)
  const reduced = useReducedMotion()
  useEffect(() => {
    const timer = setTimeout(() => setClosing(true), 3200)
    return () => clearTimeout(timer)
  }, [])
  useEffect(() => {
    if (!closing) return
    const timer = setTimeout(onDismiss, reduced ? 0 : 180)
    return () => clearTimeout(timer)
  }, [closing, reduced, onDismiss])
  return <div className={`toast ${kind}${closing ? ' is-closing' : ''}`}
    role={kind === 'error' ? 'alert' : 'status'} aria-atomic="true">{message}</div>
}
