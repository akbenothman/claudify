import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppState,
  Dashboard,
  PtySpawnOptions,
  RepoInfo,
  Session,
  Settings,
  ShellInfo,
  SplitPlan,
  SplitTask,
  Worktree,
  WorktreeDiff
} from '../shared/types'

export const PORT_TAG = 'claudify:pty-port'

/**
 * A MessagePort cannot cross `contextBridge` — it is not a structured-cloneable
 * value there. Electron's supported route is to re-post it into the main world
 * with `window.postMessage`, which does honour the transfer list. The renderer
 * picks it up by id in `ptyPorts.ts`.
 */
ipcRenderer.on('pty:port', (event, { id }: { id: string }) => {
  window.postMessage({ tag: PORT_TAG, id }, '*', [event.ports[0]])
})

const api = {
  /**
   * Spawns a PTY. Resolves with the id; the MessagePort for it arrives
   * separately via `window.postMessage` and is claimed by the renderer.
   */
  createTerminal: (opts: PtySpawnOptions): Promise<string> => ipcRenderer.invoke('pty:create', opts),
  killTerminal: (id: string): Promise<void> => ipcRenderer.invoke('pty:kill', id),

  gitInfo: (cwd: string): Promise<RepoInfo> => ipcRenderer.invoke('git:info', cwd),
  listWorktrees: (repoRoot: string): Promise<Worktree[]> =>
    ipcRenderer.invoke('git:worktrees', repoRoot),
  diff: (repoRoot: string, baseRef: string, branch: string): Promise<WorktreeDiff> =>
    ipcRenderer.invoke('git:diff', repoRoot, baseRef, branch),
  patch: (repoRoot: string, baseRef: string, branch: string): Promise<string> =>
    ipcRenderer.invoke('git:patch', repoRoot, baseRef, branch),
  merge: (
    repoRoot: string,
    baseRef: string,
    branch: string
  ): Promise<{ ok: boolean; message: string }> =>
    ipcRenderer.invoke('git:merge', repoRoot, baseRef, branch),
  commitAll: (wtPath: string, message: string): Promise<boolean> =>
    ipcRenderer.invoke('git:commitAll', wtPath, message),
  removeWorktree: (repoRoot: string, wtPath: string, branch?: string): Promise<void> =>
    ipcRenderer.invoke('git:removeWorktree', repoRoot, wtPath, branch),

  planSplit: (cwd: string, request: string): Promise<SplitPlan> =>
    ipcRenderer.invoke('split:plan', cwd, request),
  createWorktrees: (repoRoot: string, baseRef: string, tasks: SplitTask[]): Promise<Worktree[]> =>
    ipcRenderer.invoke('split:createWorktrees', repoRoot, baseRef, tasks),

  pickFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:pickFolder'),
  home: (): Promise<string> => ipcRenderer.invoke('app:home'),
  platform: process.platform,

  getDashboard: (): Promise<Dashboard> => ipcRenderer.invoke('dashboard:get'),
  saveDashboard: (data: Dashboard): Promise<void> => ipcRenderer.invoke('dashboard:save', data),
  dashboardPath: (): Promise<string> => ipcRenderer.invoke('dashboard:path'),
  /** Fires when the dashboard file changes on disk (i.e. an agent edited it). */
  onDashboardChanged: (cb: (d: Dashboard) => void): (() => void) => {
    const handler = (_e: unknown, d: Dashboard) => cb(d)
    ipcRenderer.on('dashboard:changed', handler)
    return () => ipcRenderer.off('dashboard:changed', handler)
  },

  loadState: (): Promise<AppState> => ipcRenderer.invoke('state:load'),
  saveSession: (session: Session): Promise<void> => ipcRenderer.invoke('session:save', session),
  saveSettings: (patch: Partial<Settings>): Promise<Settings> =>
    ipcRenderer.invoke('settings:save', patch),
  getSettings: (): Promise<Settings> => ipcRenderer.invoke('settings:get'),
  detectShells: (): Promise<ShellInfo[]> => ipcRenderer.invoke('shells:detect')
}

contextBridge.exposeInMainWorld('claudify', api)

export type ClaudifyApi = typeof api
