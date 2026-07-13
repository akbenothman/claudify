import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export interface MenuItem {
  label: string
  onClick: () => void
  danger?: boolean
  /** Renders a separator above this item. */
  separated?: boolean
}

export interface MenuState {
  x: number
  y: number
  items: MenuItem[]
}

export function ContextMenu({ menu, onClose }: { menu: MenuState; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: menu.x, y: menu.y })

  // Keep the menu on screen when it's opened near an edge.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos({
      x: Math.min(menu.x, window.innerWidth - r.width - 8),
      y: Math.min(menu.y, window.innerHeight - r.height - 8)
    })
  }, [menu.x, menu.y])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="menu-backdrop" onMouseDown={onClose} onContextMenu={(e) => e.preventDefault()}>
      <div
        className="menu"
        ref={ref}
        style={{ left: pos.x, top: pos.y }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {menu.items.map((it, i) => (
          <button
            key={i}
            className={`menu-item${it.danger ? ' danger' : ''}${it.separated ? ' sep' : ''}`}
            onClick={() => {
              it.onClick()
              onClose()
            }}
          >
            {it.label}
          </button>
        ))}
      </div>
    </div>
  )
}
