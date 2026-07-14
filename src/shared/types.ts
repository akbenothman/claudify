/** Shared contract between main and renderer. */

export interface PtySpawnOptions {
  /** Working directory for the shell. */
  cwd: string
  /** Executable to run. Defaults to the platform shell. */
  shell?: string
  /** Argv for the shell. */
  args?: string[]
  cols: number
  rows: number
  /** Extra env vars layered over the inherited environment. */
  env?: Record<string, string>
  /**
   * A command typed into the shell once it is ready. Used to launch `claude`
   * inside a freshly created worktree pane.
   */
  initialCommand?: string
}

export interface SplitTask {
  /** Filesystem/branch-safe identifier, e.g. `dark-mode`. */
  slug: string
  /** Branch created for this task, e.g. `claudify/dark-mode`. */
  branch: string
  /** Human-readable one-liner shown in the tab. */
  title: string
  /** The prompt handed to the Claude running in this worktree. */
  prompt: string
}

export interface SplitPlan {
  repoRoot: string
  baseRef: string
  tasks: SplitTask[]
  /** True when a heuristic split was used because the planner was unavailable. */
  degraded: boolean
}

export interface Worktree {
  slug: string
  branch: string
  title: string
  path: string
}

export interface WorktreeDiff {
  branch: string
  /** Output of `git diff --stat base...branch`. */
  stat: string
  filesChanged: number
  insertions: number
  deletions: number
  /** True when the branch has no commits beyond base. */
  empty: boolean
}

export interface RepoInfo {
  root: string
  branch: string
  isRepo: boolean
}

/* ------------------------------ persistence ------------------------------- */

export interface ShellInfo {
  /** Stable key stored in settings, e.g. `cmd`. */
  id: string
  label: string
  path: string
  args: string[]
}

export interface Settings {
  /** `ShellInfo.id` of the shell new terminals spawn. */
  shellId: string
  fontSize: number
}

/**
 * The persisted session. Mirrors the renderer's workspace tree, minus anything
 * transient (attention rings, exit flags) and minus `initialCommand` — we will
 * not silently re-run an agent on a task days later just because you rebooted.
 */
export interface PersistedPane {
  id: string
  kind: 'terminal' | 'merge' | 'todo' | 'tracker' | 'notes'
  title: string
  cwd: string
  custom?: boolean
  branch?: string
  worktreePath?: string
  /** Only ever set for opted-in panes (the dashboard's Claude REPL). */
  initialCommand?: string
  persistCommand?: boolean
  /**
   * The pane's terminal buffer as of the last save, ANSI escapes and all, so a
   * restarted pane comes back showing what it showed before. Cosmetic: the
   * shell underneath is a new process.
   */
  scrollback?: string
}

export interface PersistedTab {
  id: string
  title: string
  custom?: boolean
  /** Marked unread by hand; unlike a pane's `unseen`, viewing it doesn't clear it. */
  flagged?: boolean
  panes: PersistedPane[]
  /** Serialized layout tree; shape matches the renderer's LayoutNode. */
  layout: unknown
  activePaneId: string | null
}

export interface PersistedWorkspace {
  id: string
  name: string
  cwd: string
  tabs: PersistedTab[]
  activeTabId: string | null
  split?: { repoRoot: string; baseRef: string; worktrees: Worktree[] }
  permanent?: boolean
}

export interface Session {
  workspaces: PersistedWorkspace[]
  activeWorkspaceId: string | null
}

export interface AppState {
  version: number
  settings: Settings
  session: Session
}

/* ------------------------------- dashboard -------------------------------- */

export type TodoStatus = 'todo' | 'doing' | 'blocked' | 'done'
export type ConvoStatus = 'active' | 'waiting' | 'done'

export interface Todo {
  id: string
  text: string
  status: TodoStatus
  updated?: string
}

export interface Conversation {
  id: string
  title: string
  status: ConvoStatus
  summary?: string
  updated?: string
}

/** A named todo list. Topics are the tabs across the top of the todo pane. */
export interface Topic {
  id: string
  name: string
  todos: Todo[]
}

/** One page of the notepad. Also tabs; the body is plain text. */
export interface Note {
  id: string
  name: string
  body: string
  updated?: string
}

export interface Dashboard {
  /** Schema note written into the file so an agent editing it knows the rules. */
  _instructions: string
  topics: Topic[]
  notes: Note[]
  conversations: Conversation[]
  /**
   * Superseded by `topics`, kept so an older dashboard.json (and anything still
   * writing one) is read rather than silently dropped. On load these are folded
   * into a topic; we never write it back.
   */
  todos?: Todo[]
}
