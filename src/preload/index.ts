import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppState,
  BrowserInfo,
  Calendar,
  CheckResult,
  ConflictPair,
  ControlRequest,
  Dashboard,
  PtySpawnOptions,
  RepoInfo,
  Session,
  Settings,
  ShellInfo,
  SplitPlan,
  SplitTask,
  TranscriptStats,
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
  /** Run a worktree's test command and report pass/fail. */
  checkWorktree: (repoRoot: string, wtPath: string): Promise<CheckResult> =>
    ipcRenderer.invoke('git:check', repoRoot, wtPath),
  /** Dry-run pairwise merges and report which branches conflict. */
  previewConflicts: (repoRoot: string, branches: string[]): Promise<ConflictPair[]> =>
    ipcRenderer.invoke('git:conflicts', repoRoot, branches),
  /** Apply a subset patch (adopted hunks) to the base working tree. */
  applyPatch: (repoRoot: string, patch: string): Promise<{ ok: boolean; message: string }> =>
    ipcRenderer.invoke('git:apply', repoRoot, patch),
  removeWorktree: (repoRoot: string, wtPath: string, branch?: string): Promise<void> =>
    ipcRenderer.invoke('git:removeWorktree', repoRoot, wtPath, branch),

  planSplit: (cwd: string, request: string): Promise<SplitPlan> =>
    ipcRenderer.invoke('split:plan', cwd, request),
  createWorktrees: (repoRoot: string, baseRef: string, tasks: SplitTask[]): Promise<Worktree[]> =>
    ipcRenderer.invoke('split:createWorktrees', repoRoot, baseRef, tasks),

  pickFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:pickFolder'),
  home: (): Promise<string> => ipcRenderer.invoke('app:home'),
  platform: process.platform,

  /**
   * Subscribe a pane's cwd to its Claude Code transcript. Resolves with a
   * snapshot; further updates arrive via `onTranscript`.
   */
  subscribeTranscript: (cwd: string): Promise<TranscriptStats> =>
    ipcRenderer.invoke('transcript:subscribe', cwd),
  unsubscribeTranscript: (cwd: string): void =>
    ipcRenderer.send('transcript:unsubscribe', cwd),
  /** Fires when any subscribed transcript changes on disk. Keyed by cwd. */
  onTranscript: (cb: (s: TranscriptStats) => void): (() => void) => {
    const handler = (_e: unknown, s: TranscriptStats) => cb(s)
    ipcRenderer.on('transcript:stats', handler)
    return () => ipcRenderer.off('transcript:stats', handler)
  },

  /** Fires when an agent appends a new request to control.json. */
  onControlRequest: (cb: (r: ControlRequest) => void): (() => void) => {
    const handler = (_e: unknown, r: ControlRequest) => cb(r)
    ipcRenderer.on('control:request', handler)
    return () => ipcRenderer.off('control:request', handler)
  },
  /** Record the outcome of a control request back into the file. */
  resolveControl: (id: string, ok: boolean, message: string): void =>
    ipcRenderer.send('control:resolve', id, ok, message),
  notify: (title: string, body: string): void => ipcRenderer.send('control:notify', title, body),
  controlPath: (): Promise<string> => ipcRenderer.invoke('control:path'),

  getDashboard: (): Promise<Dashboard> => ipcRenderer.invoke('dashboard:get'),
  saveDashboard: (data: Dashboard): Promise<void> => ipcRenderer.invoke('dashboard:save', data),
  dashboardPath: (): Promise<string> => ipcRenderer.invoke('dashboard:path'),
  /** Fires when the dashboard file changes on disk (i.e. an agent edited it). */
  onDashboardChanged: (cb: (d: Dashboard) => void): (() => void) => {
    const handler = (_e: unknown, d: Dashboard) => cb(d)
    ipcRenderer.on('dashboard:changed', handler)
    return () => ipcRenderer.off('dashboard:changed', handler)
  },

  /* browser pane — position the native view over the pane and drive it */
  browserAttach: (paneId: string, bounds: Electron.Rectangle): void =>
    ipcRenderer.send('browser:attach', paneId, bounds),
  browserBounds: (paneId: string, bounds: Electron.Rectangle): void =>
    ipcRenderer.send('browser:bounds', paneId, bounds),
  browserDetach: (paneId: string): void => ipcRenderer.send('browser:detach', paneId),
  browserNavigate: (url: string): Promise<BrowserInfo> => ipcRenderer.invoke('browser:navigate', url),
  browserBack: (): Promise<BrowserInfo> => ipcRenderer.invoke('browser:back'),
  browserReload: (): Promise<BrowserInfo> => ipcRenderer.invoke('browser:reload'),
  browserInfo: (): Promise<BrowserInfo> => ipcRenderer.invoke('browser:info'),
  mcpConfigPath: (): Promise<string> => ipcRenderer.invoke('mcp:configPath'),

  getCalendar: (): Promise<Calendar> => ipcRenderer.invoke('calendar:get'),
  saveCalendar: (data: Calendar): Promise<void> => ipcRenderer.invoke('calendar:save', data),
  calendarPath: (): Promise<string> => ipcRenderer.invoke('calendar:path'),
  /** Fires when the calendar file changes on disk (an agent synced it). */
  onCalendarChanged: (cb: (c: Calendar) => void): (() => void) => {
    const handler = (_e: unknown, c: Calendar) => cb(c)
    ipcRenderer.on('calendar:changed', handler)
    return () => ipcRenderer.off('calendar:changed', handler)
  },

  loadState: (): Promise<AppState> => ipcRenderer.invoke('state:load'),
  saveSession: (session: Session): Promise<void> => ipcRenderer.invoke('session:save', session),
  /**
   * The last save, on the way out. Synchronous on purpose: an `invoke` issued
   * from `beforeunload` races the renderer's own teardown and routinely loses.
   */
  saveSessionNow: (session: Session): void => {
    ipcRenderer.sendSync('session:save-now', session)
  },
  saveSettings: (patch: Partial<Settings>): Promise<Settings> =>
    ipcRenderer.invoke('settings:save', patch),
  getSettings: (): Promise<Settings> => ipcRenderer.invoke('settings:get'),
  detectShells: (): Promise<ShellInfo[]> => ipcRenderer.invoke('shells:detect')
}

contextBridge.exposeInMainWorld('claudify', api)

export type ClaudifyApi = typeof api
