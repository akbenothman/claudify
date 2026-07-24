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
  /**
   * Watch the output for Claude Code's "Do you trust the files in this folder?"
   * prompt and answer it with Enter automatically. Set for panes that launch
   * `claude`, so a new workspace never stalls on a dialog the user must clear by
   * hand. Harmless when the prompt never appears.
   */
  autoConfirmTrust?: boolean
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

/** Result of running a worktree's test/check command before merging. */
export interface CheckResult {
  /** False when no check command could be found (nothing to run). */
  ran: boolean
  ok: boolean
  cmd: string
  /** Tail of combined stdout/stderr, for the user to glance at. */
  output: string
}

/** Two task branches that would conflict if both were merged. */
export interface ConflictPair {
  a: string
  b: string
  files: string[]
}

/** Current location of the claudify browser. */
export interface BrowserInfo {
  url: string
  title: string
}

/* ---------------------------- control surface ----------------------------- */

/**
 * One request an agent writes into `control.json` to drive the terminal itself
 * — the same "just a file every agent's Write tool can touch" bet the dashboard
 * makes, extended past todos to notifications, pane status, and pane input.
 */
export interface ControlRequest {
  /** Stable id the agent assigns; how the result is written back. */
  id: string
  action: 'notify' | 'status' | 'message' | 'focus'
  /** notify: desktop toast + taskbar flash. */
  title?: string
  body?: string
  /** status/message/focus: substring matched against a pane's cwd/title/branch. */
  match?: string
  /** status: the pane status to set. */
  state?: 'idle' | 'working' | 'blocked' | 'finished'
  /** message: text typed into the matched pane (Enter is appended). */
  text?: string
  /** Written by claudify once it has acted; agents poll this to see the result. */
  status?: 'pending' | 'done' | 'error'
  result?: string
  resolvedAt?: string
}

export interface ControlFile {
  _instructions: string
  requests: ControlRequest[]
}

/* ------------------------------ transcripts ------------------------------- */

/**
 * A snapshot derived from a pane's Claude Code session transcript
 * (`~/.claude/projects/**`). Read-only; used to make the pane's status honest
 * and to show a per-pane token/cost meter.
 */
export interface TranscriptStats {
  /** The pane cwd this was computed for; the renderer keys on it. */
  cwd: string
  /** False when no transcript exists for this cwd yet. */
  found: boolean
  sessionId?: string
  /** Claude Code's own aiTitle for the session, if it has named one. */
  title?: string
  /** Model id of the most recent assistant turn, e.g. `claude-opus-4-8`. */
  model?: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  /** Estimated spend in USD across the whole session. */
  costUsd: number
  /** Number of assistant turns. */
  messages: number
  /** Epoch ms of the last transcript event. */
  lastActivity: number
  /**
   * The newest assistant turn issued a tool call no later turn has answered —
   * i.e. the agent is waiting on a tool, most often a permission prompt. Paired
   * with the pane going quiet, this is what "blocked" means.
   */
  pendingToolUse: boolean
}

/**
 * One Claude Code session, discovered from its transcript on disk. The
 * conversations pane lists these automatically — no manual tracking — so you can
 * see every thread and where each was left off.
 */
export interface ConversationInfo {
  sessionId: string
  /** Working directory the session ran in. */
  cwd: string
  /** Claude's own title for the session, or a fallback from the first message. */
  title: string
  /** Epoch ms of the last transcript activity. */
  updated: number
  /** A short description of where the thread was left off (the last exchange). */
  leftOff: string
  /** The last assistant turn is waiting on a tool/permission — it needs you. */
  pendingToolUse: boolean
  /** Number of assistant turns. */
  messages: number
  model?: string
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
  /**
   * Start Claudify automatically when you log in to Windows. Only takes effect
   * for the installed app — in dev it would register electron.exe, so it's a
   * no-op there.
   */
  launchAtLogin?: boolean
}

/**
 * What a pane shows. `terminal`, `merge` and `browser` are tools; the rest are
 * the AK Dashboard's pages, each of which is a view onto `dashboard.json`.
 */
export type PaneKind =
  | 'terminal'
  | 'merge'
  | 'browser'
  | 'home'
  | 'todo'
  | 'notes'
  | 'goals'
  | 'habits'
  | 'business'
  | 'finance'
  | 'calendar'
  | 'tracker'

/**
 * The persisted session. Mirrors the renderer's workspace tree, minus anything
 * transient (attention rings, exit flags) and minus `initialCommand` — we will
 * not silently re-run an agent on a task days later just because you rebooted.
 */
export interface PersistedPane {
  id: string
  kind: PaneKind
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
  /** Dashboard layout generation the permanent workspace was last built with. */
  dashVersion?: number
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

/* --------------------------------- goals ---------------------------------- */

/** How far out a goal reaches. Drives the grouping on the goals page. */
export type GoalHorizon = 'year' | 'quarter' | 'month' | 'someday'

export interface Milestone {
  id: string
  text: string
  done: boolean
}

export interface Goal {
  id: string
  title: string
  /** One line of context: why this matters, or what "done" looks like. */
  detail?: string
  horizon: GoalHorizon
  /** 0–100. Set by hand, or derived from milestones when there are any. */
  progress: number
  /** ISO date it should be finished by. */
  due?: string
  milestones?: Milestone[]
  updated?: string
}

/* -------------------------------- business -------------------------------- */

export type VentureStage = 'idea' | 'building' | 'launched' | 'growing' | 'parked'

/** One business, product or side project on the business page. */
export interface Venture {
  id: string
  name: string
  stage: VentureStage
  /** One line on what it is. */
  pitch?: string
  /** Monthly recurring revenue, as last known. */
  mrr?: number
  /** The single next thing that moves it forward. */
  nextAction?: string
  url?: string
  updated?: string
}

/* -------------------------------- finance --------------------------------- */

export interface Account {
  id: string
  name: string
  /** Free text: checking, savings, brokerage, card, crypto… */
  kind?: string
  balance: number
  /** A debt: counts against net worth rather than towards it. */
  liability?: boolean
  updated?: string
}

/** Money that arrives or leaves on a schedule — salary, rent, subscriptions. */
export interface Recurring {
  id: string
  name: string
  amount: number
  cadence: 'weekly' | 'monthly' | 'yearly'
  direction: 'in' | 'out'
  updated?: string
}

export interface Finance {
  accounts: Account[]
  recurring: Recurring[]
  /** What the savings meter measures against. */
  savingsTarget?: number
  /** Currency symbol used for display only; no conversion happens anywhere. */
  currency?: string
}

/* --------------------------------- habits --------------------------------- */

export interface Habit {
  id: string
  name: string
  /** How many days a week this should happen. Defaults to 7. */
  targetPerWeek?: number
  /** Local `YYYY-MM-DD` dates it was done on. */
  done: string[]
  updated?: string
}

/* -------------------------------- calendar -------------------------------- */

/** One upcoming event, mirrored from Google Calendar by an agent. */
export interface CalEvent {
  id: string
  title: string
  /** ISO-8601 start. All-day events may omit the time portion. */
  start: string
  end?: string
  location?: string
  /** Where it came from, e.g. "google". Informational. */
  source?: string
}

/**
 * A request the calendar pane writes for an agent to fulfil via the Google
 * Calendar MCP — add or delete an event. The agent acts, updates `events`, and
 * marks the request done. Claudify never talks to Google itself.
 */
export interface CalRequest {
  id: string
  action: 'add' | 'delete'
  /** add: the new event's fields. delete: `eventId` of the one to remove. */
  title?: string
  start?: string
  end?: string
  location?: string
  eventId?: string
  status?: 'pending' | 'done' | 'error'
  result?: string
}

export interface Calendar {
  _instructions: string
  events: CalEvent[]
  requests: CalRequest[]
  /** ISO time the events list was last refreshed by an agent. */
  syncedAt?: string
  /**
   * A short natural-language digest of what's coming up, written by the calendar
   * agent and shown beneath the month grid ("3 meetings tomorrow; nothing after
   * Thursday"). Plain text; the app never generates it.
   */
  summary?: string
}

export interface Dashboard {
  /** Schema note written into the file so an agent editing it knows the rules. */
  _instructions: string
  topics: Topic[]
  notes: Note[]
  conversations: Conversation[]
  goals: Goal[]
  ventures: Venture[]
  finance: Finance
  habits: Habit[]
  /**
   * Superseded by `topics`, kept so an older dashboard.json (and anything still
   * writing one) is read rather than silently dropped. On load these are folded
   * into a topic; we never write it back.
   */
  todos?: Todo[]
}
