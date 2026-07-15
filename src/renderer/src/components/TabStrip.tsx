import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * A horizontally scrollable wrapper for a row of tabs. When the tabs overflow a
 * narrow pane, chevrons appear at the ends to scroll left/right; the strip
 * itself hides its scrollbar. The optional `trailing` node (e.g. a "+" button)
 * stays pinned after the scroll area, always visible.
 *
 * Used by the todo and notes panes, whose topic/page tabs can outgrow the pane.
 */
export function TabStrip({
  children,
  trailing
}: {
  children: ReactNode
  trailing?: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [ov, setOv] = useState({ left: false, right: false })

  const measure = (): void => {
    const el = ref.current
    if (!el) return
    setOv({
      left: el.scrollLeft > 2,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2
    })
  }

  // Re-check overflow after every render — tabs get added and removed.
  useEffect(() => {
    measure()
  })

  // Live updates as the pane resizes or the strip is scrolled by wheel/trackpad.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    el.addEventListener('scroll', measure)
    return () => {
      ro.disconnect()
      el.removeEventListener('scroll', measure)
    }
  }, [])

  const scroll = (dir: number): void => {
    ref.current?.scrollBy({ left: dir * 120, behavior: 'smooth' })
  }

  return (
    <div className="tabstrip">
      {ov.left && (
        <button className="tabstrip-arrow" onClick={() => scroll(-1)} title="Scroll left">
          ‹
        </button>
      )}
      <div className="board-tabs" ref={ref}>
        {children}
      </div>
      {ov.right && (
        <button className="tabstrip-arrow" onClick={() => scroll(1)} title="Scroll right">
          ›
        </button>
      )}
      {trailing}
    </div>
  )
}
