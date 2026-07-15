import { create } from 'zustand'
import type { Session, SplitPlan, TranscriptStats, Worktree } from '../../shared/types'

export type Direction = 'row' | 'col'

/**
 * What the pane is doing right now.
 * - `idle`     nothing running; sitting at a prompt
 * - `working`  output is actively flowing (a command, or an agent thinking)
 * - `blocked`  an agent is waiting on you to approve a tool / answer a prompt
 * - `finished` an agent was working and has now gone quiet — it's your turn
 */
export type PaneStatus = 'idle' | 'working' | 'blocked' | 'finished'

/** Recursive split layout, same shape as tmux/wezterm pane trees. */
export type LayoutNode =
  | { kind: 'leaf'; paneId: string }
  | { kind: 'split'; id: string; dir: Direction; ratio: number; a: LayoutNode; b: LayoutNode }

export interface Pane {
  id: string
  kind: 'terminal' | 'merge' | 'todo' | 'tracker' | 'notes' | 'calendar' | 'browser'
  title: string
  cwd: string
  /** Typed into the shell once it is ready (used to launch `claude`). */
  initialCommand?: string
  /**
   * Keep `initialCommand` across restarts. Only for panes whose command is
   * merely "start the REPL" (the dashboard's Claude) — never for worktree task
   * panes, which would re-run a real task on reboot.
   */
  persistCommand?: boolean
  /** Set when this pane is a worktree task pane. */
  branch?: string
  worktreePath?: string
  exited?: boolean
  /** cmux-style "needs you" ring, raised by OSC 9 / OSC 777 / bell. */
  attention?: boolean
  /** The user renamed this by hand; stop auto-naming it. */
  custom?: boolean
  /** Working / finished indicator. */
  status?: PaneStatus
  /**
   * Something happened here that you haven't looked at yet — it finished, or it
   * rang the bell, while this pane was off screen. Cleared when you actually see
   * it. This is what separates "done" from "done, and you still need to check it".
   */
  unseen?: boolean
  /** True once an agent CLI (claude, codex, …) is running in this pane. */
  agent?: boolean
  /**
   * Latest snapshot from this pane's Claude Code transcript, when one exists.
   * Drives the token/cost meter and the honest working/blocked/finished status.
   */
  stats?: TranscriptStats
  /**
   * Buffer restored from the last session, replayed into xterm when the pane
   * mounts. Only ever read at mount; the live buffer is owned by xterm itself
   * and snapshotted through the scrollback registry, never kept in the store.
   */
  scrollback?: string
}

/** A tab owns one split tree. Workspace > tabs > panes, like wezterm. */
export interface Tab {
  id: string
  title: string
  panes: Record<string, Pane>
  layout: LayoutNode | null
  activePaneId: string | null
  zoomedPaneId: string | null
  /** The user renamed this by hand; stop deriving it from the active pane. */
  custom?: boolean
  /**
   * Marked unread by hand. Distinct from a pane's `unseen`, which the app clears
   * the moment you look at the tab — this one is yours, and survives being
   * looked at. It goes away when you clear it, and not before.
   */
  flagged?: boolean
}

export interface Workspace {
  id: string
  name: string
  cwd: string
  tabs: Tab[]
  activeTabId: string | null
  /** Present when this workspace was produced by a worktree split. */
  split?: { repoRoot: string; baseRef: string; worktrees: Worktree[] }
  /** The AK Dashboard. Always first, cannot be deleted. */
  permanent?: boolean
}

interface State {
  workspaces: Workspace[]
  activeWorkspaceId: string | null
  defaultCwd: string

  setDefaultCwd: (cwd: string) => void

  newWorkspace: (name?: string, cwd?: string) => string
  closeWorkspace: (id: string) => void
  setActiveWorkspace: (id: string) => void
  renameWorkspace: (id: string, name: string) => void

  newTab: (wsId: string, cwd?: string) => void
  /** Open a new tab holding a browser pane (the one Claude drives via MCP). */
  newBrowserTab: (wsId: string) => void
  closeTab: (wsId: string, tabId: string) => void
  setActiveTab: (wsId: string, tabId: string) => void
  renameTab: (wsId: string, tabId: string, title: string) => void
  renamePane: (wsId: string, tabId: string, paneId: string, title: string) => void
  autoNamePane: (wsId: string, tabId: string, paneId: string, title: string) => void

  /** Reorder a tab, or move it to another workspace. */
  moveTab: (srcWsId: string, tabId: string, dstWsId: string, index: number) => void
  /** Drop a tab onto a pane: its panes join that tab as a new split. */
  mergeTabIntoPane: (
    srcWsId: string,
    srcTabId: string,
    dstWsId: string,
    dstTabId: string,
    dstPaneId: string,
    edge: 'left' | 'right' | 'top' | 'bottom'
  ) => void
  /** Pop a pane out of its tab and back into a tab of its own. */
  movePaneToTab: (
    srcWsId: string,
    srcTabId: string,
    paneId: string,
    dstWsId: string,
    index: number
  ) => void
  /** Drop a pane onto another pane: it re-splits there, wherever it came from. */
  movePaneIntoPane: (
    srcWsId: string,
    srcTabId: string,
    paneId: string,
    dstWsId: string,
    dstTabId: string,
    dstPaneId: string,
    edge: 'left' | 'right' | 'top' | 'bottom'
  ) => void
  moveWorkspace: (fromIndex: number, toIndex: number) => void

  setPaneStatus: (wsId: string, tabId: string, paneId: string, status: PaneStatus) => void
  raiseAttention: (wsId: string, tabId: string, paneId: string) => void
  /** Mark everything in this tab as looked-at. */
  acknowledgeTab: (wsId: string, tabId: string) => void
  /** Flag/unflag a tab as unread by hand. Survives looking at it. */
  setTabFlagged: (wsId: string, tabId: string, flagged: boolean) => void

  splitPane: (wsId: string, tabId: string, paneId: string, dir: Direction) => void
  closePane: (wsId: string, tabId: string, paneId: string) => void
  setActivePane: (wsId: string, tabId: string, paneId: string) => void
  toggleZoom: (wsId: string, tabId: string) => void
  setRatio: (wsId: string, tabId: string, splitId: string, ratio: number) => void
  updatePane: (wsId: string, tabId: string, paneId: string, patch: Partial<Pane>) => void

  createSplitWorkspace: (plan: SplitPlan, worktrees: Worktree[]) => string

  /** Restore a previously saved session. */
  hydrate: (session: Session) => void
  /** Create the permanent AK Dashboard workspace if it isn't already there. */
  ensureDashboard: (cwd: string) => void
}

export const DASHBOARD_NAME = 'AK Dashboard'

let seq = 1
const uid = (p: string) => `${p}-${seq++}`

/**
 * Path to claudify's own MCP config, learned at boot. When set, panes launch
 * `claude --mcp-config <it>` so the browser tools appear automatically without
 * ever touching the user's global Claude config.
 */
let mcpConfig = ''
export function setMcpConfig(p: string): void {
  // Forward slashes work on every shell (cmd/PowerShell/bash) and dodge all
  // backslash-escaping ambiguity when this is typed into a terminal.
  mcpConfig = p.replace(/\\/g, '/')
}

/** The command that launches Claude in a pane, wired to the browser MCP. */
export function claudeCommand(extra?: string): string {
  const flag = mcpConfig ? ` --mcp-config "${mcpConfig}"` : ''
  return `claude${flag}${extra ? ` ${extra}` : ''}`
}

/* --------------------------- layout tree helpers --------------------------- */

function replaceLeaf(node: LayoutNode, paneId: string, next: LayoutNode): LayoutNode {
  if (node.kind === 'leaf') return node.paneId === paneId ? next : node
  return { ...node, a: replaceLeaf(node.a, paneId, next), b: replaceLeaf(node.b, paneId, next) }
}

/** Drops a leaf and collapses the now-single-child split that contained it. */
function removeLeaf(node: LayoutNode, paneId: string): LayoutNode | null {
  if (node.kind === 'leaf') return node.paneId === paneId ? null : node
  const a = removeLeaf(node.a, paneId)
  const b = removeLeaf(node.b, paneId)
  if (!a) return b
  if (!b) return a
  return { ...node, a, b }
}

function firstLeaf(node: LayoutNode): string | null {
  return node.kind === 'leaf' ? node.paneId : firstLeaf(node.a) ?? firstLeaf(node.b)
}

function setRatioIn(node: LayoutNode, splitId: string, ratio: number): LayoutNode {
  if (node.kind === 'leaf') return node
  if (node.id === splitId) return { ...node, ratio }
  return { ...node, a: setRatioIn(node.a, splitId, ratio), b: setRatioIn(node.b, splitId, ratio) }
}

/**
 * Builds a balanced grid from N panes by halving the list and alternating
 * direction with depth, which gives tidy 2x2 / 2x3 layouts after a split rather
 * than a row of slivers.
 */
function buildGrid(paneIds: string[], depth = 0): LayoutNode {
  if (paneIds.length === 1) return { kind: 'leaf', paneId: paneIds[0] }
  const mid = Math.ceil(paneIds.length / 2)
  return {
    kind: 'split',
    id: uid('split'),
    dir: depth % 2 === 0 ? 'row' : 'col',
    ratio: 0.5,
    a: buildGrid(paneIds.slice(0, mid), depth + 1),
    b: buildGrid(paneIds.slice(mid), depth + 1)
  }
}

function makeTab(cwd: string, title = 'shell', initialCommand?: string): Tab {
  const paneId = uid('pane')
  return {
    id: uid('tab'),
    title,
    panes: { [paneId]: { id: paneId, kind: 'terminal', title: 'shell', cwd, initialCommand } },
    layout: { kind: 'leaf', paneId },
    activePaneId: paneId,
    zoomedPaneId: null
  }
}

/* --------------------------------- store ---------------------------------- */

const mapWs = (s: State, wsId: string, fn: (ws: Workspace) => Workspace): Partial<State> => ({
  workspaces: s.workspaces.map((w) => (w.id === wsId ? fn(w) : w))
})

const mapTab = (ws: Workspace, tabId: string, fn: (t: Tab) => Tab): Workspace => ({
  ...ws,
  tabs: ws.tabs.map((t) => (t.id === tabId ? fn(t) : t))
})

/**
 * Is this pane actually in front of the user right now?
 *
 * Its workspace and tab must both be active AND the window must have focus — a
 * pane "finishing" while the app is minimised is precisely the thing you haven't
 * checked on, even though it is nominally the active tab.
 */
function isOnScreen(s: State, wsId: string, tabId: string): boolean {
  if (s.activeWorkspaceId !== wsId) return false
  const ws = s.workspaces.find((w) => w.id === wsId)
  if (ws?.activeTabId !== tabId) return false
  return document.hasFocus()
}

const clearSeen = (t: Tab): Tab => ({
  ...t,
  panes: Object.fromEntries(
    Object.entries(t.panes).map(([id, p]) =>
      p.unseen || p.attention ? [id, { ...p, unseen: false, attention: false }] : [id, p]
    )
  )
})

export const useStore = create<State>((set, get) => ({
  workspaces: [],
  activeWorkspaceId: null,
  defaultCwd: '',

  setDefaultCwd: (cwd) => set({ defaultCwd: cwd }),

  newWorkspace: (name, cwd) => {
    const wsId = uid('ws')
    const dir = cwd || get().defaultCwd
    // A new workspace opens with Claude already running on its first tab. Not
    // persisted (no persistCommand), so a restored workspace comes back as a
    // plain shell rather than re-launching Claude on every reboot.
    const tab = makeTab(dir, 'shell', claudeCommand())
    set((s) => ({
      workspaces: [
        ...s.workspaces,
        {
          id: wsId,
          name: name || `workspace ${s.workspaces.length + 1}`,
          cwd: dir,
          tabs: [tab],
          activeTabId: tab.id
        }
      ],
      activeWorkspaceId: wsId
    }))
    return wsId
  },

  closeWorkspace: (id) =>
    set((s) => {
      // The dashboard is permanent; deleting it is not on the menu.
      if (s.workspaces.find((w) => w.id === id)?.permanent) return {}
      const workspaces = s.workspaces.filter((w) => w.id !== id)
      return {
        workspaces,
        activeWorkspaceId:
          s.activeWorkspaceId === id
            ? workspaces[workspaces.length - 1]?.id ?? null
            : s.activeWorkspaceId
      }
    }),

  setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),

  renameWorkspace: (id, name) => set((s) => mapWs(s, id, (ws) => ({ ...ws, name }))),

  newTab: (wsId, cwd) =>
    set((s) =>
      mapWs(s, wsId, (ws) => {
        // A new tab opens where you are, not where the workspace began. The
        // active pane's cwd tracks `cd` (see the OSC 9;9 handler), so this is
        // the directory you were actually looking at.
        const active = ws.tabs.find((t) => t.id === ws.activeTabId)
        const here = active?.activePaneId ? active.panes[active.activePaneId]?.cwd : undefined
        const tab = makeTab(cwd || here || ws.cwd || s.defaultCwd)
        return { ...ws, tabs: [...ws.tabs, tab], activeTabId: tab.id }
      })
    ),

  newBrowserTab: (wsId) =>
    set((s) =>
      mapWs(s, wsId, (ws) => {
        const paneId = uid('pane')
        const tab: Tab = {
          id: uid('tab'),
          title: 'browser',
          custom: true,
          panes: { [paneId]: { id: paneId, kind: 'browser', title: 'browser', cwd: ws.cwd } },
          layout: { kind: 'leaf', paneId },
          activePaneId: paneId,
          zoomedPaneId: null
        }
        return { ...ws, tabs: [...ws.tabs, tab], activeTabId: tab.id }
      })
    ),

  closeTab: (wsId, tabId) =>
    set((s) =>
      mapWs(s, wsId, (ws) => {
        const tabs = ws.tabs.filter((t) => t.id !== tabId)
        return {
          ...ws,
          tabs,
          activeTabId:
            ws.activeTabId === tabId ? tabs[tabs.length - 1]?.id ?? null : ws.activeTabId
        }
      })
    ),

  setActiveTab: (wsId, tabId) => set((s) => mapWs(s, wsId, (ws) => ({ ...ws, activeTabId: tabId }))),

  renameTab: (wsId, tabId, title) =>
    set((s) =>
      mapWs(s, wsId, (ws) =>
        mapTab(ws, tabId, (t) => {
          const renamed: Tab = { ...t, title, custom: true }

          /*
           * A tab holding one pane IS that pane as far as anyone looking at the
           * screen is concerned — the tab and the pane header sit inches apart
           * and say the same thing. So renaming the tab renames the pane with
           * it, custom, which also stops the auto-namer from putting "shell"
           * back the next time you run something.
           *
           * A split is different: those panes are separate terminals with names
           * of their own, and one tab name can't stand in for all of them.
           */
          const ids = Object.keys(t.panes)
          if (ids.length !== 1) return renamed
          const only = t.panes[ids[0]]
          return {
            ...renamed,
            panes: { [only.id]: { ...only, title, custom: true } }
          }
        })
      )
    ),

  renamePane: (wsId, tabId, paneId, title) =>
    set((s) =>
      mapWs(s, wsId, (ws) =>
        mapTab(ws, tabId, (t) =>
          t.panes[paneId]
            ? { ...t, panes: { ...t.panes, [paneId]: { ...t.panes[paneId], title, custom: true } } }
            : t
        )
      )
    ),

  moveTab: (srcWsId, tabId, dstWsId, index) =>
    set((s) => {
      const src = s.workspaces.find((w) => w.id === srcWsId)
      const tab = src?.tabs.find((t) => t.id === tabId)
      if (!src || !tab) return {}

      const workspaces = s.workspaces.map((w) => {
        let tabs = w.id === srcWsId ? w.tabs.filter((t) => t.id !== tabId) : w.tabs

        if (w.id === dstWsId) {
          // Clamp: after removing the tab from this same list, the old index may
          // now be past the end.
          const at = Math.max(0, Math.min(index, tabs.length))
          tabs = [...tabs.slice(0, at), tab, ...tabs.slice(at)]
        }
        if (tabs === w.tabs) return w

        const activeTabId =
          w.id === dstWsId
            ? tab.id
            : w.activeTabId === tabId
              ? tabs[tabs.length - 1]?.id ?? null
              : w.activeTabId

        return { ...w, tabs, activeTabId }
      })

      return { workspaces, activeWorkspaceId: dstWsId }
    }),

  mergeTabIntoPane: (srcWsId, srcTabId, dstWsId, dstTabId, dstPaneId, edge) =>
    set((s) => {
      const srcWs = s.workspaces.find((w) => w.id === srcWsId)
      const srcTab = srcWs?.tabs.find((t) => t.id === srcTabId)
      const dstWs = s.workspaces.find((w) => w.id === dstWsId)
      const dstTab = dstWs?.tabs.find((t) => t.id === dstTabId)

      // Dropping a tab onto a pane it already owns would splice the tree into
      // itself.
      if (!srcTab || !dstTab || !srcTab.layout || !dstTab.layout) return {}
      if (srcTabId === dstTabId) return {}

      const dir: Direction = edge === 'left' || edge === 'right' ? 'row' : 'col'
      const incomingFirst = edge === 'left' || edge === 'top'
      const target: LayoutNode = { kind: 'leaf', paneId: dstPaneId }

      const combined: LayoutNode = {
        kind: 'split',
        id: uid('split'),
        dir,
        ratio: 0.5,
        a: incomingFirst ? srcTab.layout : target,
        b: incomingFirst ? target : srcTab.layout
      }

      const workspaces = s.workspaces
        .map((w) => {
          if (w.id !== srcWsId) return w
          const tabs = w.tabs.filter((t) => t.id !== srcTabId)
          return {
            ...w,
            tabs,
            activeTabId:
              w.activeTabId === srcTabId ? tabs[tabs.length - 1]?.id ?? null : w.activeTabId
          }
        })
        .map((w) => {
          if (w.id !== dstWsId) return w
          return {
            ...w,
            activeTabId: dstTabId,
            tabs: w.tabs.map((t) =>
              t.id !== dstTabId
                ? t
                : {
                    ...t,
                    panes: { ...t.panes, ...srcTab.panes },
                    layout: replaceLeaf(t.layout!, dstPaneId, combined),
                    activePaneId: srcTab.activePaneId ?? t.activePaneId,
                    zoomedPaneId: null
                  }
            )
          }
        })

      return { workspaces, activeWorkspaceId: dstWsId }
    }),

  /*
   * Both pane moves below are pure data edits. Stage renders every pane of every
   * workspace as one flat list keyed by pane id, so relocating a pane in the
   * tree does NOT unmount its React node — the terminal, and the process inside
   * it, carry on through the move. That is the whole reason the layout lives in
   * the store instead of in nested DOM.
   */

  movePaneToTab: (srcWsId, srcTabId, paneId, dstWsId, index) =>
    set((s) => {
      const srcWs = s.workspaces.find((w) => w.id === srcWsId)
      const srcTab = srcWs?.tabs.find((t) => t.id === srcTabId)
      const pane = srcTab?.panes[paneId]
      if (!srcTab || !pane || !srcTab.layout) return {}

      // A tab with one pane is already "its own tab" — popping it out would just
      // destroy and recreate the same thing.
      if (Object.keys(srcTab.panes).length <= 1 && srcWsId === dstWsId) return {}

      const newTab: Tab = {
        id: uid('tab'),
        title: pane.title,
        panes: { [paneId]: pane },
        layout: { kind: 'leaf', paneId },
        activePaneId: paneId,
        zoomedPaneId: null
      }

      const workspaces = s.workspaces
        .map((w) => {
          if (w.id !== srcWsId) return w
          const tabs = w.tabs
            .map((t) => {
              if (t.id !== srcTabId || !t.layout) return t
              const panes = { ...t.panes }
              delete panes[paneId]
              const layout = removeLeaf(t.layout, paneId)
              return {
                ...t,
                panes,
                layout,
                activePaneId: layout ? firstLeaf(layout) : null,
                zoomedPaneId: t.zoomedPaneId === paneId ? null : t.zoomedPaneId
              }
            })
            // The pane it held was the last one: the tab goes with it.
            .filter((t) => Object.keys(t.panes).length > 0)
          return { ...w, tabs }
        })
        .map((w) => {
          if (w.id !== dstWsId) return w
          const at = Math.max(0, Math.min(index, w.tabs.length))
          const tabs = [...w.tabs.slice(0, at), newTab, ...w.tabs.slice(at)]
          return { ...w, tabs, activeTabId: newTab.id }
        })
        .map((w) => ({
          ...w,
          activeTabId:
            w.tabs.some((t) => t.id === w.activeTabId)
              ? w.activeTabId
              : w.tabs[w.tabs.length - 1]?.id ?? null
        }))

      return { workspaces, activeWorkspaceId: dstWsId }
    }),

  movePaneIntoPane: (srcWsId, srcTabId, paneId, dstWsId, dstTabId, dstPaneId, edge) =>
    set((s) => {
      if (paneId === dstPaneId) return {}

      const srcWs = s.workspaces.find((w) => w.id === srcWsId)
      const srcTab = srcWs?.tabs.find((t) => t.id === srcTabId)
      const pane = srcTab?.panes[paneId]
      const dstWs = s.workspaces.find((w) => w.id === dstWsId)
      const dstTab = dstWs?.tabs.find((t) => t.id === dstTabId)
      if (!srcTab || !pane || !srcTab.layout || !dstTab || !dstTab.layout) return {}

      const dir: Direction = edge === 'left' || edge === 'right' ? 'row' : 'col'
      const incomingFirst = edge === 'left' || edge === 'top'
      const splice = (layout: LayoutNode): LayoutNode =>
        replaceLeaf(layout, dstPaneId, {
          kind: 'split',
          id: uid('split'),
          dir,
          ratio: 0.5,
          a: incomingFirst ? { kind: 'leaf', paneId } : { kind: 'leaf', paneId: dstPaneId },
          b: incomingFirst ? { kind: 'leaf', paneId: dstPaneId } : { kind: 'leaf', paneId }
        })

      // Within one tab this is a single edit: pull the leaf out, then splice it
      // back in next to the target. Doing it as remove-then-add across two
      // copies of the tab would lose whichever edit landed second.
      if (srcTabId === dstTabId) {
        const pruned = removeLeaf(srcTab.layout, paneId)
        if (!pruned) return {}
        return mapWs(s, dstWsId, (ws) =>
          mapTab(ws, dstTabId, (t) => ({
            ...t,
            layout: splice(pruned),
            activePaneId: paneId,
            zoomedPaneId: null
          }))
        )
      }

      const workspaces = s.workspaces
        .map((w) => {
          if (w.id !== srcWsId) return w
          const tabs = w.tabs
            .map((t) => {
              if (t.id !== srcTabId || !t.layout) return t
              const panes = { ...t.panes }
              delete panes[paneId]
              const layout = removeLeaf(t.layout, paneId)
              return {
                ...t,
                panes,
                layout,
                activePaneId: layout ? firstLeaf(layout) : null,
                zoomedPaneId: t.zoomedPaneId === paneId ? null : t.zoomedPaneId
              }
            })
            .filter((t) => Object.keys(t.panes).length > 0)
          return { ...w, tabs }
        })
        .map((w) => {
          if (w.id !== dstWsId) return w
          return {
            ...w,
            activeTabId: dstTabId,
            tabs: w.tabs.map((t) =>
              t.id !== dstTabId || !t.layout
                ? t
                : {
                    ...t,
                    panes: { ...t.panes, [paneId]: pane },
                    layout: splice(t.layout),
                    activePaneId: paneId,
                    zoomedPaneId: null
                  }
            )
          }
        })
        .map((w) => ({
          ...w,
          activeTabId:
            w.tabs.some((t) => t.id === w.activeTabId)
              ? w.activeTabId
              : w.tabs[w.tabs.length - 1]?.id ?? null
        }))

      return { workspaces, activeWorkspaceId: dstWsId }
    }),

  moveWorkspace: (fromIndex, toIndex) =>
    set((s) => {
      const workspaces = [...s.workspaces]
      const [moved] = workspaces.splice(fromIndex, 1)
      if (!moved) return {}
      workspaces.splice(Math.max(0, Math.min(toIndex, workspaces.length)), 0, moved)
      return { workspaces }
    }),

  setPaneStatus: (wsId, tabId, paneId, status) => {
    // A pane that finishes off screen is unseen. One that finishes while you're
    // watching it is not — you just saw it happen.
    const offScreen = !isOnScreen(get(), wsId, tabId)
    set((s) =>
      mapWs(s, wsId, (ws) =>
        mapTab(ws, tabId, (t) => {
          const p = t.panes[paneId]
          if (!p) return t
          // Both "finished" and "blocked" are your-turn states: if they happen
          // off screen, they're unseen until you actually look.
          const yourTurn = status === 'finished' || status === 'blocked'
          const unseen = yourTurn ? p.unseen || offScreen : p.unseen
          if (p.status === status && p.unseen === unseen) return t
          return { ...t, panes: { ...t.panes, [paneId]: { ...p, status, unseen } } }
        })
      )
    )
  },

  raiseAttention: (wsId, tabId, paneId) => {
    const offScreen = !isOnScreen(get(), wsId, tabId)
    set((s) =>
      mapWs(s, wsId, (ws) =>
        mapTab(ws, tabId, (t) => {
          const p = t.panes[paneId]
          if (!p) return t
          return {
            ...t,
            panes: { ...t.panes, [paneId]: { ...p, attention: true, unseen: p.unseen || offScreen } }
          }
        })
      )
    )
  },

  // Note this clears the panes' `unseen`, never the tab's `flagged`: looking at
  // a tab is what clears the app's notion of unseen, and precisely NOT what
  // clears yours.
  acknowledgeTab: (wsId, tabId) =>
    set((s) => mapWs(s, wsId, (ws) => mapTab(ws, tabId, clearSeen))),

  setTabFlagged: (wsId, tabId, flagged) =>
    set((s) => mapWs(s, wsId, (ws) => mapTab(ws, tabId, (t) => ({ ...t, flagged })))),

  /** Derived name. Silently declines to overwrite a name the user chose. */
  autoNamePane: (wsId, tabId, paneId, title) =>
    set((s) =>
      mapWs(s, wsId, (ws) =>
        mapTab(ws, tabId, (t) => {
          const p = t.panes[paneId]
          if (!p || p.custom || p.title === title) return t
          return { ...t, panes: { ...t.panes, [paneId]: { ...p, title } } }
        })
      )
    ),

  splitPane: (wsId, tabId, paneId, dir) =>
    set((s) =>
      mapWs(s, wsId, (ws) =>
        mapTab(ws, tabId, (tab) => {
          const src = tab.panes[paneId]
          if (!src || !tab.layout) return tab
          const newId = uid('pane')
          // A new pane inherits the cwd of the pane it was split from — what
          // tmux/wezterm do, and what you want when splitting off a worktree.
          const pane: Pane = { id: newId, kind: 'terminal', title: 'shell', cwd: src.cwd }
          const replacement: LayoutNode = {
            kind: 'split',
            id: uid('split'),
            dir,
            ratio: 0.5,
            a: { kind: 'leaf', paneId },
            b: { kind: 'leaf', paneId: newId }
          }
          return {
            ...tab,
            panes: { ...tab.panes, [newId]: pane },
            layout: replaceLeaf(tab.layout, paneId, replacement),
            activePaneId: newId,
            zoomedPaneId: null
          }
        })
      )
    ),

  closePane: (wsId, tabId, paneId) => {
    // The PTY is killed by TerminalPane's unmount cleanup, which owns the real
    // pty id (pane ids and pty ids are separate namespaces).
    const ws = get().workspaces.find((w) => w.id === wsId)
    const tab = ws?.tabs.find((t) => t.id === tabId)
    // Closing the last pane in a tab closes the tab, rather than leaving an
    // empty shell of a tab behind.
    if (tab && Object.keys(tab.panes).length <= 1) {
      get().closeTab(wsId, tabId)
      return
    }
    set((s) =>
      mapWs(s, wsId, (w) =>
        mapTab(w, tabId, (t) => {
          if (!t.layout) return t
          const layout = removeLeaf(t.layout, paneId)
          const panes = { ...t.panes }
          delete panes[paneId]
          return {
            ...t,
            panes,
            layout,
            activePaneId: layout ? firstLeaf(layout) : null,
            zoomedPaneId: t.zoomedPaneId === paneId ? null : t.zoomedPaneId
          }
        })
      )
    )
  },

  setActivePane: (wsId, tabId, paneId) =>
    set((s) =>
      mapWs(s, wsId, (ws) =>
        mapTab(ws, tabId, (t) => ({
          ...t,
          activePaneId: paneId,
          // Clicking into a pane is the strongest possible "I've seen this".
          panes: t.panes[paneId]
            ? { ...t.panes, [paneId]: { ...t.panes[paneId], attention: false, unseen: false } }
            : t.panes
        }))
      )
    ),

  toggleZoom: (wsId, tabId) =>
    set((s) =>
      mapWs(s, wsId, (ws) =>
        mapTab(ws, tabId, (t) => ({
          ...t,
          zoomedPaneId: t.zoomedPaneId ? null : t.activePaneId
        }))
      )
    ),

  setRatio: (wsId, tabId, splitId, ratio) =>
    set((s) =>
      mapWs(s, wsId, (ws) =>
        mapTab(ws, tabId, (t) => ({
          ...t,
          layout: t.layout ? setRatioIn(t.layout, splitId, ratio) : t.layout
        }))
      )
    ),

  updatePane: (wsId, tabId, paneId, patch) =>
    set((s) =>
      mapWs(s, wsId, (ws) =>
        mapTab(ws, tabId, (t) =>
          t.panes[paneId]
            ? { ...t, panes: { ...t.panes, [paneId]: { ...t.panes[paneId], ...patch } } }
            : t
        )
      )
    ),

  createSplitWorkspace: (plan, worktrees) => {
    const wsId = uid('ws')
    const panes: Record<string, Pane> = {}
    const ids: string[] = []

    for (const wt of worktrees) {
      const task = plan.tasks.find((t) => t.slug === wt.slug || wt.slug.startsWith(t.slug))
      const id = uid('pane')
      ids.push(id)
      panes[id] = {
        id,
        kind: 'terminal',
        title: wt.title || wt.slug,
        cwd: wt.path,
        branch: wt.branch,
        worktreePath: wt.path,
        // The whole point: each pane comes up with Claude already working on its
        // own task, in its own worktree.
        initialCommand: task ? claudeCommand(JSON.stringify(task.prompt)) : undefined
      }
    }

    // The merge view always gets the last cell in the grid.
    const mergeId = uid('pane')
    panes[mergeId] = { id: mergeId, kind: 'merge', title: 'merge', cwd: plan.repoRoot }
    ids.push(mergeId)

    const tab: Tab = {
      id: uid('tab'),
      title: 'agents',
      panes,
      layout: buildGrid(ids),
      activePaneId: ids[0],
      zoomedPaneId: null
    }

    set((s) => ({
      workspaces: [
        ...s.workspaces,
        {
          id: wsId,
          name: `split · ${worktrees.length} tasks`,
          cwd: plan.repoRoot,
          tabs: [tab],
          activeTabId: tab.id,
          split: { repoRoot: plan.repoRoot, baseRef: plan.baseRef, worktrees }
        }
      ],
      activeWorkspaceId: wsId
    }))
    return wsId
  },

  ensureDashboard: (cwd) => {
    /*
     * A dashboard saved before the notepad existed has a plain shell down the
     * left. Convert it in place rather than leaving long-standing users with the
     * old layout — the pane keeps its id and slot, so nothing else moves.
     *
     * The dashboard's Claude is a terminal too; it's the one with persistCommand
     * set, and it is emphatically not the pane to replace.
     */
    // A standalone tab holding one board pane. Used for the calendar, which
    // lives beside the dashboard tab rather than crowding into its grid.
    const boardTab = (kind: Pane['kind'], title: string): Tab => {
      const paneId = uid('pane')
      return {
        id: uid('tab'),
        title,
        custom: true,
        panes: { [paneId]: { id: paneId, kind, title, cwd } },
        layout: { kind: 'leaf', paneId },
        activePaneId: paneId,
        zoomedPaneId: null
      }
    }

    const existing = get().workspaces.find((w) => w.permanent)
    if (existing) {
      const hasKind = (k: Pane['kind']) =>
        existing.tabs.some((t) => Object.values(t.panes).some((p) => p.kind === k))

      // The calendar is a newer addition — give long-standing dashboards one.
      if (!hasKind('calendar')) {
        const tab = boardTab('calendar', 'calendar')
        set((s) => ({
          workspaces: s.workspaces.map((w) =>
            w.permanent ? { ...w, tabs: [...w.tabs, tab] } : w
          )
        }))
      }

      if (hasKind('notes')) return

      set((s) => ({
        workspaces: s.workspaces.map((w) => {
          if (!w.permanent) return w
          let converted = false
          return {
            ...w,
            tabs: w.tabs.map((t) => {
              const target = Object.values(t.panes).find(
                (p) => !converted && p.kind === 'terminal' && !p.persistCommand
              )
              if (!target) return t
              converted = true
              return {
                ...t,
                panes: {
                  ...t.panes,
                  [target.id]: {
                    ...target,
                    kind: 'notes' as const,
                    title: 'notes',
                    custom: false,
                    status: 'idle' as PaneStatus
                  }
                }
              }
            })
          }
        })
      }))
      return
    }

    const mk = (p: Omit<Pane, 'id'>): Pane => ({ ...p, id: uid('pane') })

    const notes = mk({ kind: 'notes', title: 'notes', cwd })
    const claude = mk({
      kind: 'terminal',
      title: 'claude',
      cwd,
      // Just opens the REPL — no task — so it's safe to bring back on every boot.
      initialCommand: claudeCommand(),
      persistCommand: true
    })
    const todo = mk({ kind: 'todo', title: 'todo', cwd })
    const tracker = mk({ kind: 'tracker', title: 'conversations', cwd })

    // Notepad down the left; Claude filling the right; todo + tracker sharing
    // the bottom of that column.
    const layout: LayoutNode = {
      kind: 'split',
      id: uid('split'),
      dir: 'row',
      ratio: 0.24,
      a: { kind: 'leaf', paneId: notes.id },
      b: {
        kind: 'split',
        id: uid('split'),
        dir: 'col',
        ratio: 0.58,
        a: { kind: 'leaf', paneId: claude.id },
        b: {
          kind: 'split',
          id: uid('split'),
          dir: 'row',
          ratio: 0.5,
          a: { kind: 'leaf', paneId: todo.id },
          b: { kind: 'leaf', paneId: tracker.id }
        }
      }
    }

    const tab: Tab = {
      id: uid('tab'),
      title: 'dashboard',
      custom: true,
      panes: Object.fromEntries([notes, claude, todo, tracker].map((p) => [p.id, p])),
      layout,
      activePaneId: claude.id,
      zoomedPaneId: null
    }

    const ws: Workspace = {
      id: uid('ws'),
      name: DASHBOARD_NAME,
      cwd,
      // The main dashboard, plus a calendar tab beside it.
      tabs: [tab, boardTab('calendar', 'calendar')],
      activeTabId: tab.id,
      permanent: true
    }

    // Always first in the sidebar.
    set((s) => ({
      workspaces: [ws, ...s.workspaces],
      activeWorkspaceId: s.activeWorkspaceId ?? ws.id
    }))
  },

  hydrate: (session) => {
    // Restored ids were minted by a previous run's counter. If we don't advance
    // `seq` past them, the next new pane reuses an existing id and React starts
    // rendering two panes with the same key.
    let max = 0
    for (const m of JSON.stringify(session).matchAll(/"(?:ws|tab|pane|split)-(\d+)"/g)) {
      max = Math.max(max, parseInt(m[1], 10))
    }
    seq = max + 1

    const workspaces: Workspace[] = session.workspaces.map((w) => ({
      id: w.id,
      name: w.name,
      cwd: w.cwd,
      activeTabId: w.activeTabId,
      split: w.split,
      permanent: w.permanent,
      tabs: w.tabs.map((t) => ({
        id: t.id,
        title: t.title,
        custom: t.custom,
        // A tab you flagged is still flagged tomorrow — that's what makes it a
        // reminder rather than a highlight.
        flagged: t.flagged,
        layout: t.layout as LayoutNode | null,
        activePaneId: t.activePaneId,
        zoomedPaneId: null,
        panes: Object.fromEntries(
          t.panes.map((p) => [
            p.id,
            {
              id: p.id,
              kind: p.kind,
              title: p.title,
              cwd: p.cwd,
              custom: p.custom,
              branch: p.branch,
              worktreePath: p.worktreePath,
              // Only the dashboard's Claude comes back running; see persistCommand.
              initialCommand: p.persistCommand ? p.initialCommand : undefined,
              persistCommand: p.persistCommand,
              scrollback: p.scrollback,
              status: 'idle' as PaneStatus
            }
          ])
        )
      }))
    }))

    set({
      workspaces,
      activeWorkspaceId:
        session.activeWorkspaceId && workspaces.some((w) => w.id === session.activeWorkspaceId)
          ? session.activeWorkspaceId
          : workspaces[0]?.id ?? null
    })
  }
}))

/**
 * Snapshot for disk. Drops everything transient, and deliberately drops
 * `initialCommand`: restoring a worktree pane must not silently re-run an agent
 * on a task days after the fact. Shells come back in their saved cwd, freshly
 * spawned, showing the buffer they had when you quit.
 *
 * `scrollback` here is only the value we restored with — the *live* buffer lives
 * in xterm and is merged in by the persistence layer, which can reach the
 * mounted terminals. Carrying the old value through matters for a pane that
 * hasn't mounted yet, whose history would otherwise be erased by the first save.
 */
export const serialize = (s: State): Session => ({
  activeWorkspaceId: s.activeWorkspaceId,
  workspaces: s.workspaces.map((w) => ({
    id: w.id,
    name: w.name,
    cwd: w.cwd,
    activeTabId: w.activeTabId,
    split: w.split,
    permanent: w.permanent,
    tabs: w.tabs.map((t) => ({
      id: t.id,
      title: t.title,
      custom: t.custom,
      flagged: t.flagged,
      layout: t.layout,
      activePaneId: t.activePaneId,
      panes: Object.values(t.panes).map((p) => ({
        id: p.id,
        kind: p.kind,
        title: p.title,
        cwd: p.cwd,
        custom: p.custom,
        branch: p.branch,
        worktreePath: p.worktreePath,
        // Persisted only for panes that opted in — i.e. the dashboard's Claude
        // REPL, never a worktree task pane.
        initialCommand: p.persistCommand ? p.initialCommand : undefined,
        persistCommand: p.persistCommand,
        scrollback: p.scrollback
      }))
    }))
  }))
})

export const activeWorkspace = (s: State): Workspace | undefined =>
  s.workspaces.find((w) => w.id === s.activeWorkspaceId)

/**
 * Locate a pane by a substring the control surface passes — matched against its
 * cwd, title, or branch. First match wins; agent panes are preferred so
 * "message the claude working on auth" lands on the agent, not a sibling shell.
 */
export function findPane(
  s: State,
  match: string
): { wsId: string; tabId: string; paneId: string; pane: Pane } | null {
  const needle = match.toLowerCase()
  const hits: { wsId: string; tabId: string; paneId: string; pane: Pane }[] = []
  for (const w of s.workspaces) {
    for (const t of w.tabs) {
      for (const p of Object.values(t.panes)) {
        const hay = `${p.cwd} ${p.title} ${p.branch ?? ''}`.toLowerCase()
        if (hay.includes(needle)) hits.push({ wsId: w.id, tabId: t.id, paneId: p.id, pane: p })
      }
    }
  }
  if (hits.length === 0) return null
  return hits.find((h) => h.pane.agent || h.pane.kind === 'terminal') ?? hits[0]
}

/** True when any pane in the tab is asking for attention. */
export const tabNeedsAttention = (t: Tab): boolean =>
  Object.values(t.panes).some((p) => p.attention)

export const workspaceNeedsAttention = (w: Workspace): boolean => w.tabs.some(tabNeedsAttention)

/**
 * What a tab is called. Unless the user renamed it, a tab borrows the name of
 * its active pane — which is itself auto-derived from what's running there. So
 * running `npm run dev` in a pane renames its tab to "npm dev" for free.
 */
export const tabTitle = (t: Tab): string => {
  if (t.custom) return t.title
  const active = t.activePaneId ? t.panes[t.activePaneId] : undefined
  return active?.title || t.title
}

/**
 * Roll-up status for a tab / workspace. "Something in here is still working"
 * outranks "something in here has finished", because the finished thing can
 * wait and the working thing tells you not to bother looking yet.
 */
const rollUp = (statuses: (PaneStatus | undefined)[]): PaneStatus => {
  if (statuses.includes('working')) return 'working'
  // A pane waiting on you outranks one that has merely finished — it can't make
  // progress until you act.
  if (statuses.includes('blocked')) return 'blocked'
  if (statuses.includes('finished')) return 'finished'
  return 'idle'
}

export const tabStatus = (t: Tab): PaneStatus =>
  rollUp(Object.values(t.panes).map((p) => p.status))

export const workspaceStatus = (w: Workspace): PaneStatus => rollUp(w.tabs.map(tabStatus))

/**
 * Something in here finished (or rang) while you weren't looking — or you said
 * so yourself. A hand-flagged tab stays lit whether or not you're looking at it;
 * that is the entire point of flagging it.
 */
export const tabUnseen = (t: Tab): boolean =>
  !!t.flagged || Object.values(t.panes).some((p) => p.unseen)

export const workspaceUnseen = (w: Workspace): boolean => w.tabs.some(tabUnseen)

/** A located pane, as returned by the "needs you" walk and the palette. */
export interface PaneRef {
  wsId: string
  tabId: string
  paneId: string
  pane: Pane
}

/**
 * Every pane that is asking for you right now — blocked on a permission, newly
 * finished, or ringing for attention — in a stable top-to-bottom order. This is
 * what "jump to the next agent that needs me" walks through.
 */
export function panesNeedingYou(s: State): PaneRef[] {
  const out: PaneRef[] = []
  for (const w of s.workspaces) {
    for (const t of w.tabs) {
      for (const p of Object.values(t.panes)) {
        if (p.status === 'blocked' || p.status === 'finished' || p.unseen || p.attention) {
          out.push({ wsId: w.id, tabId: t.id, paneId: p.id, pane: p })
        }
      }
    }
  }
  // Blocked outranks finished outranks a bare unseen flag, so the most urgent
  // pane is the first place Ctrl+J lands.
  const rank = (p: Pane): number =>
    p.status === 'blocked' ? 0 : p.status === 'finished' ? 1 : 2
  return out.sort((a, b) => rank(a.pane) - rank(b.pane))
}

/** How many things across everything are still waiting to be checked on. */
export const unseenCount = (s: State): number =>
  s.workspaces.reduce(
    (n, w) =>
      n +
      w.tabs.reduce(
        (m, t) =>
          m +
          (t.flagged ? 1 : 0) +
          Object.values(t.panes).filter((p) => p.unseen).length,
        0
      ),
    0
  )
