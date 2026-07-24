import { useCallback, useState } from 'react'
import { Icon } from './Icon'
import { useStore, type Pane, type Tab, type Workspace } from '../store'
import { computePlacements, edgeFor, type Edge, type Rect } from '../layout'
import { TerminalPane } from './TerminalPane'
import { MergeView } from './MergeView'
import { TodoPane } from './TodoPane'
import { NotesPane } from './NotesPane'
import { TrackerPane } from './TrackerPane'
import { CalendarPane } from './CalendarPane'
import { BrowserPane } from './BrowserPane'
import { HomePane } from './HomePane'
import { GoalsPane } from './GoalsPane'
import { HabitsPane } from './HabitsPane'
import { BusinessPane } from './BusinessPane'
import { FinancePane } from './FinancePane'
import { StatusDot } from './StatusDot'
import { PANE_MIME, TAB_MIME, type PaneDrag, type TabDrag } from '../dnd'

const pct = (r: Rect) => ({
  left: `${r.x}%`,
  top: `${r.y}%`,
  width: `${r.w}%`,
  height: `${r.h}%`
})

const ZOOMED: Rect = { x: 0, y: 0, w: 100, h: 100 }

const compact = (n: number): string =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`

/**
 * Per-pane token + cost readout, from the pane's Claude Code transcript. Only
 * shows once the agent has actually spent tokens, so a plain shell stays clean.
 */
function CostMeter({ pane }: { pane: Pane }) {
  const s = pane.stats
  if (!s || !s.found) return null
  const total = s.inputTokens + s.outputTokens + s.cacheReadTokens + s.cacheWriteTokens
  if (total === 0) return null
  const title =
    `${s.model ?? 'model'} · ${compact(s.inputTokens)} in · ${compact(s.outputTokens)} out · ` +
    `${compact(s.cacheReadTokens)} cache-read · ~$${s.costUsd.toFixed(2)} (estimate)`
  return (
    <span className="pane-meter" title={title}>
      {compact(total)} · ${s.costUsd.toFixed(2)}
    </span>
  )
}

function PaneFrame({
  ws,
  tab,
  pane,
  rect,
  visible
}: {
  ws: Workspace
  tab: Tab
  pane: Pane
  rect: Rect
  visible: boolean
}) {
  const closePane = useStore((s) => s.closePane)
  const mergeTabIntoPane = useStore((s) => s.mergeTabIntoPane)
  const movePaneIntoPane = useStore((s) => s.movePaneIntoPane)
  const [dropEdge, setDropEdge] = useState<Edge | null>(null)

  const focused = tab.activePaneId === pane.id
  const zoomed = tab.zoomedPaneId === pane.id
  const box = zoomed ? ZOOMED : rect

  /*
   * A dashboard page fills its tab on its own — there is nothing to drag it
   * next to, nothing to close it back to, and no second pane to tell it apart
   * from. So it gets no title bar: the page starts at the top of the window and
   * reads as an app screen rather than a pane in a terminal multiplexer.
   */
  const bare = !!ws.permanent && Object.keys(tab.panes).length === 1

  const cls = [
    'pane',
    bare ? 'bare' : '',
    focused ? 'focused' : '',
    pane.attention ? 'attention' : '',
    pane.unseen ? 'unseen' : ''
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={`pane-slot${visible ? '' : ' hidden'}`} style={pct(box)}>
      <div
        className={cls}
        data-pane-id={pane.id}
        data-tab-id={tab.id}
        data-ws-id={ws.id}
        onDragOver={(e) => {
          // `types` is the only thing readable during dragover — the payload is
          // withheld until drop.
          const types = e.dataTransfer.types
          if (!types.includes(TAB_MIME) && !types.includes(PANE_MIME)) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          setDropEdge(edgeFor(e.currentTarget.getBoundingClientRect(), e.clientX, e.clientY))
        }}
        onDragLeave={() => setDropEdge(null)}
        onDrop={(e) => {
          setDropEdge(null)
          const box = e.currentTarget.getBoundingClientRect()

          const paneRaw = e.dataTransfer.getData(PANE_MIME)
          if (paneRaw) {
            e.preventDefault()
            const drag = JSON.parse(paneRaw) as PaneDrag
            if (drag.paneId === pane.id) return
            movePaneIntoPane(
              drag.wsId,
              drag.tabId,
              drag.paneId,
              ws.id,
              tab.id,
              pane.id,
              edgeFor(box, e.clientX, e.clientY)
            )
            return
          }

          const raw = e.dataTransfer.getData(TAB_MIME)
          if (!raw) return
          e.preventDefault()
          const drag = JSON.parse(raw) as TabDrag
          if (drag.tabId === tab.id) return
          mergeTabIntoPane(
            drag.wsId,
            drag.tabId,
            ws.id,
            tab.id,
            pane.id,
            edgeFor(box, e.clientX, e.clientY)
          )
        }}
      >
        {/* The head is the pane's drag handle — dragging the body would fight
            with selecting text in the terminal. Drop it on another pane to
            re-split there, or on the tab bar to give it a tab of its own. */}
        {!bare && (
          <div
            className="pane-head"
            draggable
            onDragStart={(e) => {
              const payload: PaneDrag = { wsId: ws.id, tabId: tab.id, paneId: pane.id }
              e.dataTransfer.setData(PANE_MIME, JSON.stringify(payload))
              e.dataTransfer.effectAllowed = 'move'
            }}
          >
            <StatusDot status={pane.status} unseen={pane.unseen} />
            <span className="pane-title">{pane.title}</span>
            {pane.branch && <span className="pane-branch">{pane.branch}</span>}
            {pane.status === 'blocked' && <span className="pane-blocked">needs you</span>}
            {pane.status === 'finished' && (
              <span className={pane.unseen ? 'pane-done' : 'pane-seen'}>done</span>
            )}
            <CostMeter pane={pane} />
            {pane.exited && <span className="pane-exited">exited</span>}
            <button
              className="pane-x"
              onClick={() => closePane(ws.id, tab.id, pane.id)}
              title="Close pane"
            >
              <Icon name="close" size={11} />
            </button>
          </div>
        )}

        <div className="pane-body">
          {pane.kind === 'merge' ? (
            <MergeView ws={ws} />
          ) : pane.kind === 'home' ? (
            <HomePane />
          ) : pane.kind === 'todo' ? (
            <TodoPane />
          ) : pane.kind === 'notes' ? (
            <NotesPane />
          ) : pane.kind === 'goals' ? (
            <GoalsPane />
          ) : pane.kind === 'habits' ? (
            <HabitsPane />
          ) : pane.kind === 'business' ? (
            <BusinessPane />
          ) : pane.kind === 'finance' ? (
            <FinancePane />
          ) : pane.kind === 'tracker' ? (
            <TrackerPane />
          ) : pane.kind === 'calendar' ? (
            <CalendarPane />
          ) : pane.kind === 'browser' ? (
            <BrowserPane paneId={pane.id} visible={visible} />
          ) : (
            <TerminalPane wsId={ws.id} tabId={tab.id} pane={pane} focused={focused && visible} />
          )}
        </div>

        {dropEdge && <div className={`drop-hint drop-${dropEdge}`} />}
      </div>
    </div>
  )
}

function Divider({
  wsId,
  tabId,
  splitId,
  dir,
  parent,
  pos,
  visible
}: {
  wsId: string
  tabId: string
  splitId: string
  dir: 'row' | 'col'
  parent: Rect
  pos: number
  visible: boolean
}) {
  const setRatio = useStore((s) => s.setRatio)

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      const stageEl = e.currentTarget.parentElement
      if (!stageEl) return
      const target = e.currentTarget as HTMLElement
      target.setPointerCapture(e.pointerId)

      const move = (ev: PointerEvent) => {
        const stage = stageEl.getBoundingClientRect()
        // The ratio is relative to this split's own box, not the whole stage.
        const boxX = stage.left + (parent.x / 100) * stage.width
        const boxY = stage.top + (parent.y / 100) * stage.height
        const boxW = (parent.w / 100) * stage.width
        const boxH = (parent.h / 100) * stage.height

        const raw = dir === 'row' ? (ev.clientX - boxX) / boxW : (ev.clientY - boxY) / boxH
        setRatio(wsId, tabId, splitId, Math.min(0.9, Math.max(0.1, raw)))
      }
      const up = (ev: PointerEvent) => {
        target.releasePointerCapture(ev.pointerId)
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    },
    [dir, parent.h, parent.w, parent.x, parent.y, setRatio, splitId, tabId, wsId]
  )

  const style: React.CSSProperties =
    dir === 'row'
      ? { left: `${pos}%`, top: `${parent.y}%`, height: `${parent.h}%` }
      : { top: `${pos}%`, left: `${parent.x}%`, width: `${parent.w}%` }

  return (
    <div
      className={`divider divider-${dir}${visible ? '' : ' hidden'}`}
      style={style}
      onPointerDown={onPointerDown}
    />
  )
}

/**
 * Every pane of every tab of every workspace, rendered as ONE flat keyed list of
 * absolutely-positioned siblings.
 *
 * The flatness is not cosmetic — it is the whole mechanism. If panes were nested
 * inside per-tab or per-workspace wrappers, dragging a tab elsewhere would move
 * its panes between two different sibling lists, and React would unmount and
 * remount them: PTY destroyed, agent killed. In one flat list keyed by pane id,
 * a move is just a reorder, so React relocates the existing DOM node and the
 * process inside it never notices.
 */
export function Stage() {
  const workspaces = useStore((s) => s.workspaces)
  const activeWorkspaceId = useStore((s) => s.activeWorkspaceId)

  type Item =
    | { type: 'pane'; key: string; ws: Workspace; tab: Tab; pane: Pane; rect: Rect; visible: boolean }
    | {
        type: 'divider'
        key: string
        wsId: string
        tabId: string
        splitId: string
        dir: 'row' | 'col'
        parent: Rect
        pos: number
        visible: boolean
      }

  const items: Item[] = []

  for (const ws of workspaces) {
    for (const tab of ws.tabs) {
      const tabVisible = ws.id === activeWorkspaceId && tab.id === ws.activeTabId
      const { panes, dividers } = computePlacements(tab.layout)

      for (const { paneId, rect } of panes) {
        const pane = tab.panes[paneId]
        if (!pane) continue
        items.push({
          type: 'pane',
          key: paneId,
          ws,
          tab,
          pane,
          rect,
          visible: tabVisible && (!tab.zoomedPaneId || tab.zoomedPaneId === paneId)
        })
      }

      if (!tab.zoomedPaneId) {
        for (const d of dividers) {
          items.push({
            type: 'divider',
            key: d.splitId,
            wsId: ws.id,
            tabId: tab.id,
            splitId: d.splitId,
            dir: d.dir,
            parent: d.parent,
            pos: d.pos,
            visible: tabVisible
          })
        }
      }
    }
  }

  return (
    <div className="stage">
      {items.map((it) =>
        it.type === 'pane' ? (
          <PaneFrame
            key={it.key}
            ws={it.ws}
            tab={it.tab}
            pane={it.pane}
            rect={it.rect}
            visible={it.visible}
          />
        ) : (
          <Divider
            key={it.key}
            wsId={it.wsId}
            tabId={it.tabId}
            splitId={it.splitId}
            dir={it.dir}
            parent={it.parent}
            pos={it.pos}
            visible={it.visible}
          />
        )
      )}
    </div>
  )
}
