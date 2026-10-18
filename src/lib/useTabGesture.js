import { useEffect } from 'react'

export default function useTabGesture(barRef, indicatorRef, viewRef, onChange, phase) {
  useEffect(() => {
    const bar = barRef.current
    const indicator = indicatorRef.current
    if (!bar || !indicator) return
    let drag = null
    let blockClick = false
    function reset() {
      drag = null
      indicator.style.transition = ''
      indicator.style.transform = ''
    }
    function down(e) {
      if (!e.isPrimary || e.button !== 0 || drag) return
      blockClick = false
      drag = { pid: e.pointerId, x: e.clientX, y: e.clientY, tab: e.target.closest('.tab'), fraction: viewRef.current === 'history' ? 1 : 0, moved: false }
      indicator.style.transition = 'none'
      try { bar.setPointerCapture(e.pointerId) } catch { /* noop */ }
    }
    function move(e) {
      if (!drag || e.pointerId !== drag.pid) return
      const dx = e.clientX - drag.x
      const dy = e.clientY - drag.y
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { cancel(e); return }
      if (Math.abs(dx) > 4) drag.moved = true
      const start = viewRef.current === 'history' ? 1 : 0
      drag.fraction = Math.max(0, Math.min(1, start + dx / ((bar.clientWidth - 12) / 2)))
      indicator.style.transform = `translateX(${drag.fraction * 100}%)`
    }
    function suppressClick() {
      blockClick = true
    }
    function up(e) {
      if (!drag || e.pointerId !== drag.pid) return
      const current = drag
      reset()
      suppressClick()
      if (current.moved) onChange(current.fraction >= 0.5 ? 'history' : 'list')
      else if (current.tab) onChange(current.tab === bar.querySelectorAll('.tab')[1] ? 'history' : 'list')
    }
    function cancel(e) {
      if (!drag || e.pointerId !== drag.pid) return
      suppressClick()
      reset()
    }
    function click(e) {
      if (blockClick && e.detail !== 0) { e.preventDefault(); e.stopPropagation() }
    }
    function interrupt() { if (drag) { suppressClick(); reset() } }
    function visibility() { if (document.hidden) interrupt() }
    function key(e) {
      if (!e.target.closest('.tab') || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
      e.preventDefault()
      const target = e.key === 'Home' ? 0 : e.key === 'End' ? 1 : viewRef.current === 'list' ? 1 : 0
      onChange(target ? 'history' : 'list')
      bar.querySelectorAll('.tab')[target]?.focus({ preventScroll: true })
    }
    bar.addEventListener('pointerdown', down)
    bar.addEventListener('pointermove', move)
    bar.addEventListener('pointerup', up)
    bar.addEventListener('pointercancel', cancel)
    bar.addEventListener('lostpointercapture', cancel)
    bar.addEventListener('click', click, true)
    bar.addEventListener('keydown', key)
    window.addEventListener('blur', interrupt)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      reset()
      bar.removeEventListener('pointerdown', down)
      bar.removeEventListener('pointermove', move)
      bar.removeEventListener('pointerup', up)
      bar.removeEventListener('pointercancel', cancel)
      bar.removeEventListener('lostpointercapture', cancel)
      bar.removeEventListener('click', click, true)
      bar.removeEventListener('keydown', key)
      window.removeEventListener('blur', interrupt)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [barRef, indicatorRef, viewRef, onChange, phase])
}
