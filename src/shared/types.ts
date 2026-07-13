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
