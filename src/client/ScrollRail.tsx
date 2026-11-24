import { useEffect, useState } from 'react'
import type { RefObject } from 'react'

const HIDE_AFTER_MS = 900
const MIN_THUMB_PX = 28

export function ScrollRail({ targetRef, resetKey, className = 'dtpl-scroll-rail' }: { targetRef: RefObject<HTMLDivElement | null>; resetKey: string; className?: string }) {
  const [visible, setVisible] = useState(false)
  const [thumb, setThumb] = useState({ height: 0, top: 0 })

  useEffect(() => {
    const el = targetRef.current
    if (el === null) return
    let hide: number | null = null

    const measure = () => {
      const max = el.scrollHeight - el.clientHeight
      const height = max > 0
        ? Math.min(el.clientHeight, Math.max(MIN_THUMB_PX, (el.clientHeight * el.clientHeight) / el.scrollHeight))
        : 0
      const top = max > 0 ? (el.scrollTop / max) * (el.clientHeight - height) : 0
      setThumb({ height, top })
    }

    const onScroll = () => {
      measure()
      setVisible(true)
      if (hide !== null) window.clearTimeout(hide)
      hide = window.setTimeout(() => setVisible(false), HIDE_AFTER_MS)
    }

    const observer = new ResizeObserver(measure)
    observer.observe(el)
    const content = el.firstElementChild
    if (content !== null) observer.observe(content)
    el.addEventListener('scroll', onScroll, { passive: true })
    setVisible(false)
    measure()

    return () => {
      el.removeEventListener('scroll', onScroll)
      observer.disconnect()
      if (hide !== null) window.clearTimeout(hide)
    }
  }, [targetRef, resetKey])

  return (
    <div className={className} aria-hidden="true" data-visible={visible && thumb.height > 0 ? 'true' : undefined}>
      <div
        className="dtpl-scroll-thumb"
        style={{ height: `${String(thumb.height)}px`, transform: `translateY(${String(thumb.top)}px)` }}
      />
    </div>
  )
}
