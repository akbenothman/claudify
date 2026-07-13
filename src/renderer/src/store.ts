import { create } from 'zustand'
import type { SplitPlan, Worktree } from '../../shared/types'

export type Direction = 'row' | 'col'

/** Recursive split layout, same shape as tmux/wezterm pane trees. */
export type LayoutNode =
  | { kind: 'leaf'; paneId: string }
  | { kind: 'split'; id: string; dir: Direction; ratio: number; a: LayoutNode; b: LayoutNode }

export interface Pane {
  id: string
  kind: 'terminal' | 'merge'
  title: string
  cwd: string
  /** Typed into the shell once it is ready (used to launch `claude`). */
  initialCommand?: string
  /** Set when this pane is a worktree task pane. */
  branch?: string
  worktreePath?: string
  exited?: boolean
  /** cmux-style "needs you" ring, raised by OSC 9 / OSC 777 / bell. */
  attention?: boolean
}

export interface Workspace {
  id: string
  name: string
  panes: Record<string, Pane>
  layout: LayoutNode | null
  activePaneId: string | null
  zoomedPaneId: string | null
  /** Present when this workspace was produced by a worktree split. */
  split?: { repoRoot: string; baseRef: string; worktrees: Worktree[] }
}

interface State {
  workspaces: Workspace[]
  activeWorkspaceId: string | null
  defaultCwd: string

  setDefaultCwd: (cwd: string) => void
  newWorkspace: (name?: string, cwd?: string) => string
  closeWorkspace: (id: string) => void
  setActiveWorkspace: (id: string) => void

  addPane: (wsId: string, pane: Omit<Pane, 'id'>) => string
  splitPane: (wsId: string, paneId: string, dir: Direction) => void
  closePane: (wsId: string, paneId: string) => void
  setActivePane: (wsId: string, paneId: string) => void
  toggleZoom: (wsId: string) => void
  setRatio: (wsId: string, splitId: string, ratio: number) => void
  updatePane: (wsId: string, paneId: string, patch: Partial<Pane>) => void

  createSplitWorkspace: (plan: SplitPlan, worktrees: Worktree[]) => string
}

let seq = 1
const uid = (p: string) => `${p}-${seq++}`

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
  return {
    ...node,
    a: setRatioIn(node.a, splitId, ratio),
    b: setRatioIn(node.b, splitId, ratio)
  }
}

/**
 * Builds a balanced grid from N panes by halving the list and alternating
 * direction with depth, which gives the tidy 2x2 / 2x3 layouts you want after
 * a split rather than a row of slivers.
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

/* --------------------------------- store ---------------------------------- */

function withWorkspace(
  state: State,
  wsId: string,
  fn: (ws: Workspace) => Workspace
): Partial<State> {
  return { workspaces: state.workspaces.map((w) => (w.id === wsId ? fn(w) : w)) }
}

export const useStore = create<State>((set, get) => ({
  workspaces: [],
  activeWorkspaceId: null,
  defaultCwd: '',

  setDefaultCwd: (cwd) => set({ defaultCwd: cwd }),

  newWorkspace: (name, cwd) => {
    const wsId = uid('ws')
    const paneId = uid('pane')
    const dir = cwd || get().defaultCwd
    const pane: Pane = { id: paneId, kind: 'terminal', title: 'shell', cwd: dir }

    set((s) => ({
      workspaces: [
        ...s.workspaces,
        {
          id: wsId,
          name: name || `workspace ${s.workspaces.length + 1}`,
          panes: { [paneId]: pane },
          layout: { kind: 'leaf', paneId },
          activePaneId: paneId,
          zoomedPaneId: null
        }
      ],
      activeWorkspaceId: wsId
    }))
    return wsId
  },

  closeWorkspace: (id) =>
    set((s) => {
      const workspaces = s.workspaces.filter((w) => w.id !== id)
      const activeWorkspaceId =
        s.activeWorkspaceId === id ? workspaces[workspaces.length - 1]?.id ?? null : s.activeWorkspaceId
      return { workspaces, activeWorkspaceId }
    }),

  setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),

  addPane: (wsId, pane) => {
    const paneId = uid('pane')
    set((s) =>
      withWorkspace(s, wsId, (ws) => {
        const next: Pane = { ...pane, id: paneId }
        const leaf: LayoutNode = { kind: 'leaf', paneId }
        return {
          ...ws,
          panes: { ...ws.panes, [paneId]: next },
          layout: ws.layout
            ? { kind: 'split', id: uid('split'), dir: 'row', ratio: 0.5, a: ws.layout, b: leaf }
            : leaf,
          activePaneId: paneId
        }
      })
    )
    return paneId
  },

  splitPane: (wsId, paneId, dir) =>
    set((s) =>
      withWorkspace(s, wsId, (ws) => {
        const src = ws.panes[paneId]
        if (!src || !ws.layout) return ws
        const newId = uid('pane')
        // A new pane inherits the cwd of the pane it was split from — the same
        // thing tmux/wezterm do, and what you want when splitting off a worktree.
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
          ...ws,
          panes: { ...ws.panes, [newId]: pane },
          layout: replaceLeaf(ws.layout, paneId, replacement),
          activePaneId: newId,
          zoomedPaneId: null
        }
      })
    ),

  closePane: (wsId, paneId) => {
    // The PTY is killed by TerminalPane's unmount cleanup, which owns the real
    // pty id (pane ids and pty ids are separate namespaces).
    set((s) =>
      withWorkspace(s, wsId, (ws) => {
        if (!ws.layout) return ws
        const layout = removeLeaf(ws.layout, paneId)
        const panes = { ...ws.panes }
        delete panes[paneId]
        return {
          ...ws,
          panes,
          layout,
          activePaneId: layout ? firstLeaf(layout) : null,
          zoomedPaneId: ws.zoomedPaneId === paneId ? null : ws.zoomedPaneId
        }
      })
    )
  },

  setActivePane: (wsId, paneId) =>
    set((s) =>
      withWorkspace(s, wsId, (ws) => ({
        ...ws,
        activePaneId: paneId,
        // Focusing a pane is an acknowledgement; clear its attention ring.
        panes: ws.panes[paneId]
          ? { ...ws.panes, [paneId]: { ...ws.panes[paneId], attention: false } }
          : ws.panes
      }))
    ),

  toggleZoom: (wsId) =>
    set((s) =>
      withWorkspace(s, wsId, (ws) => ({
        ...ws,
        zoomedPaneId: ws.zoomedPaneId ? null : ws.activePaneId
      }))
    ),

  setRatio: (wsId, splitId, ratio) =>
    set((s) =>
      withWorkspace(s, wsId, (ws) => ({
        ...ws,
        layout: ws.layout ? setRatioIn(ws.layout, splitId, ratio) : ws.layout
      }))
    ),

  updatePane: (wsId, paneId, patch) =>
    set((s) =>
      withWorkspace(s, wsId, (ws) =>
        ws.panes[paneId]
          ? { ...ws, panes: { ...ws.panes, [paneId]: { ...ws.panes[paneId], ...patch } } }
          : ws
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
        // The whole point: each pane comes up with Claude already working on
        // its own task, in its own worktree.
        initialCommand: task ? `claude ${JSON.stringify(task.prompt)}` : undefined
      }
    }

    // The merge view always gets the last cell in the grid.
    const mergeId = uid('pane')
    panes[mergeId] = { id: mergeId, kind: 'merge', title: 'merge', cwd: plan.repoRoot }
    ids.push(mergeId)

    set((s) => ({
      workspaces: [
        ...s.workspaces,
        {
          id: wsId,
          name: `split · ${worktrees.length} tasks`,
          panes,
          layout: buildGrid(ids),
          activePaneId: ids[0],
          zoomedPaneId: null,
          split: { repoRoot: plan.repoRoot, baseRef: plan.baseRef, worktrees }
        }
      ],
      activeWorkspaceId: wsId
    }))
    return wsId
  }
}))

export const activeWorkspace = (s: State): Workspace | undefined =>
  s.workspaces.find((w) => w.id === s.activeWorkspaceId)
