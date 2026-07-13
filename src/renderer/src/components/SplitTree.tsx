import { useCallback, useRef } from 'react'
import { useStore, type LayoutNode, type Workspace } from '../store'
import { TerminalPane } from './TerminalPane'
import { MergeView } from './MergeView'

function PaneFrame({ ws, paneId }: { ws: Workspace; paneId: string }) {
  const pane = ws.panes[paneId]
  const closePane = useStore((s) => s.closePane)
  if (!pane) return null

  const focused = ws.activePaneId === paneId
  const zoomed = ws.zoomedPaneId === paneId

  const cls = [
    'pane',
    focused ? 'focused' : '',
    pane.attention ? 'attention' : '',
    zoomed ? 'zoom-target' : ''
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={cls}>
      <div className="pane-head">
        <span className="pane-title">{pane.title}</span>
        {pane.branch && <span className="pane-branch">{pane.branch}</span>}
        {pane.exited && <span className="pane-exited">exited</span>}
        <button className="pane-x" onClick={() => closePane(ws.id, paneId)} title="Close pane">
          ×
        </button>
      </div>
      <div className="pane-body">
        {pane.kind === 'merge' ? (
          <MergeView ws={ws} />
        ) : (
          <TerminalPane wsId={ws.id} pane={pane} focused={focused} />
        )}
      </div>
    </div>
  )
}

function Divider({
  wsId,
  splitId,
  dir,
  containerRef
}: {
  wsId: string
  splitId: string
  dir: 'row' | 'col'
  containerRef: React.RefObject<HTMLDivElement | null>
}) {
  const setRatio = useStore((s) => s.setRatio)

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      const el = containerRef.current
      if (!el) return
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)

      const move = (ev: PointerEvent) => {
        const r = el.getBoundingClientRect()
        const raw =
          dir === 'row' ? (ev.clientX - r.left) / r.width : (ev.clientY - r.top) / r.height
        // Clamp so a pane can never be dragged to zero width and orphaned.
        setRatio(wsId, splitId, Math.min(0.9, Math.max(0.1, raw)))
      }
      const up = (ev: PointerEvent) => {
        ;(e.target as HTMLElement).releasePointerCapture(ev.pointerId)
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    },
    [containerRef, dir, setRatio, splitId, wsId]
  )

  return <div className={`divider divider-${dir}`} onPointerDown={onPointerDown} />
}

function Node({ ws, node }: { ws: Workspace; node: LayoutNode }) {
  const ref = useRef<HTMLDivElement>(null)

  if (node.kind === 'leaf') return <PaneFrame ws={ws} paneId={node.paneId} />

  return (
    <div className={`split split-${node.dir}`} ref={ref}>
      <div className="split-child" style={{ flex: `${node.ratio} 1 0%` }}>
        <Node ws={ws} node={node.a} />
      </div>
      <Divider wsId={ws.id} splitId={node.id} dir={node.dir} containerRef={ref} />
      <div className="split-child" style={{ flex: `${1 - node.ratio} 1 0%` }}>
        <Node ws={ws} node={node.b} />
      </div>
    </div>
  )
}

export function SplitTree({ ws }: { ws: Workspace }) {
  if (!ws.layout) {
    return <div className="empty">No panes. Ctrl+Shift+T for a new terminal.</div>
  }
  // The tree stays fully mounted while zoomed — unmounting a pane would kill its
  // PTY, and you'd lose the agent running in it. Zoom is purely presentational.
  return (
    <div className={`tree${ws.zoomedPaneId ? ' zoomed' : ''}`}>
      <Node ws={ws} node={ws.layout} />
    </div>
  )
}
