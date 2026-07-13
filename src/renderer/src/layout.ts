import type { Direction, LayoutNode } from './store'

/** A box in percentages of the stage, 0–100. */
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface PanePlacement {
  paneId: string
  rect: Rect
}

export interface DividerPlacement {
  splitId: string
  dir: Direction
  /** The box of the split being divided. The drag handler needs it to derive a ratio. */
  parent: Rect
  /** Stage-space % coordinate of the boundary line (x for 'row', y for 'col'). */
  pos: number
}

export interface Placements {
  panes: PanePlacement[]
  dividers: DividerPlacement[]
}

const FULL: Rect = { x: 0, y: 0, w: 100, h: 100 }

/**
 * Flattens the split tree into absolute rectangles.
 *
 * Panes are rendered as flat siblings rather than nested DOM, so that moving a
 * pane between tabs or workspaces is a pure data change — the DOM node stays
 * put, and its PTY (and whatever agent is running in it) survives the move.
 */
export function computePlacements(node: LayoutNode | null, rect: Rect = FULL): Placements {
  const out: Placements = { panes: [], dividers: [] }
  if (!node) return out

  const walk = (n: LayoutNode, r: Rect): void => {
    if (n.kind === 'leaf') {
      out.panes.push({ paneId: n.paneId, rect: r })
      return
    }

    if (n.dir === 'row') {
      const aw = r.w * n.ratio
      walk(n.a, { ...r, w: aw })
      walk(n.b, { x: r.x + aw, y: r.y, w: r.w - aw, h: r.h })
      out.dividers.push({ splitId: n.id, dir: n.dir, parent: r, pos: r.x + aw })
    } else {
      const ah = r.h * n.ratio
      walk(n.a, { ...r, h: ah })
      walk(n.b, { x: r.x, y: r.y + ah, w: r.w, h: r.h - ah })
      out.dividers.push({ splitId: n.id, dir: n.dir, parent: r, pos: r.y + ah })
    }
  }

  walk(node, rect)
  return out
}

/** Where in a pane a drop landed, which decides how the split is oriented. */
export type Edge = 'left' | 'right' | 'top' | 'bottom'

/**
 * Picks an edge from a pointer position inside a pane's bounding box. The
 * nearest border wins, so dropping near the top edge splits above, and so on.
 */
export function edgeFor(box: DOMRect, clientX: number, clientY: number): Edge {
  const px = (clientX - box.left) / box.width
  const py = (clientY - box.top) / box.height

  const dist: Record<Edge, number> = {
    left: px,
    right: 1 - px,
    top: py,
    bottom: 1 - py
  }
  return (Object.keys(dist) as Edge[]).reduce((best, e) => (dist[e] < dist[best] ? e : best), 'left')
}
