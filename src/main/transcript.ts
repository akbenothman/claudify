import { type BrowserWindow } from 'electron'
import { existsSync, readdirSync, readFileSync, statSync, watch } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { ConversationInfo, TranscriptStats } from '../shared/types'

/**
 * Reads Claude Code's own session transcripts instead of guessing from bytes.
 *
 * Claude Code writes an append-only JSONL log per session under
 * `~/.claude/projects/<encoded-cwd>/<sessionId>.jsonl`. Tailing the newest one
 * for a pane's working directory gives us facts the screen heuristic can only
 * approximate: exact token/cost usage, the model in use, and — because a turn
 * that ends on an unanswered `tool_use` is the shape of "waiting for you to
 * approve a tool" — whether the pane is BLOCKED rather than merely finished.
 *
 * This is read-only. We never write into Claude's directory.
 */

/**
 * Claude Code encodes a project path into a directory name by replacing every
 * character that isn't a letter or digit with a dash. `C:\Users\AK` becomes
 * `C--Users-AK`. The mapping is lossy (many paths collapse to one name), so we
 * match by comparing encodings rather than trying to decode.
 */
export function encodeCwd(cwd: string): string {
  return cwd.replace(/[^a-zA-Z0-9]/g, '-')
}

function projectsRoot(): string {
  return path.join(os.homedir(), '.claude', 'projects')
}

function projectDir(cwd: string): string {
  return path.join(projectsRoot(), encodeCwd(cwd))
}

/** Newest `.jsonl` in the project dir, or null if the agent hasn't written one. */
function newestSession(cwd: string): string | null {
  const dir = projectDir(cwd)
  let best: { file: string; mtime: number } | null = null
  try {
    for (const name of readdirSync(dir)) {
      if (!name.endsWith('.jsonl')) continue
      const full = path.join(dir, name)
      const mtime = statSync(full).mtimeMs
      if (!best || mtime > best.mtime) best = { file: full, mtime }
    }
  } catch {
    return null // no such project dir yet
  }
  return best?.file ?? null
}

/**
 * Can this exact conversation still be resumed?
 *
 * Two things have to be true, and neither can be inferred after the fact:
 * the transcript must still be on disk — `claude --resume <purged-id>` prints
 * "No conversation found" and exits 0, so a dead id is indistinguishable from a
 * healthy one once the pane has launched — and the directory it was recorded
 * against must still exist, since resuming is cwd-scoped and a deleted worktree
 * would strand the thread.
 */
export function canResume(cwd: string, sessionId: string): boolean {
  // A session id comes off a filename; refuse anything that could climb out of
  // the project directory rather than pasting it into a path.
  if (!cwd || !/^[A-Za-z0-9._-]+$/.test(sessionId)) return false
  try {
    return existsSync(cwd) && existsSync(path.join(projectDir(cwd), `${sessionId}.jsonl`))
  } catch {
    return false
  }
}

/* --------------------------------- pricing -------------------------------- */

/** USD per million tokens, by model-id substring. Longest match wins. */
const PRICES: Array<{ match: RegExp; in: number; out: number }> = [
  { match: /fable|mythos/, in: 10, out: 50 },
  { match: /opus/, in: 5, out: 25 },
  { match: /sonnet/, in: 3, out: 15 },
  { match: /haiku/, in: 1, out: 5 }
]

function priceFor(model: string | undefined): { in: number; out: number } {
  if (model) for (const p of PRICES) if (p.match.test(model)) return { in: p.in, out: p.out }
  return { in: 5, out: 25 } // default to Opus-tier rather than under-report
}

/**
 * Cost from usage. Cache writes bill at 1.25x input (the 5-minute TTL, which is
 * what a coding agent almost always uses); cache reads at 0.1x. Output at the
 * output rate. This is an estimate, and is labelled as one in the UI.
 */
function costUsd(
  model: string | undefined,
  input: number,
  output: number,
  cacheWrite: number,
  cacheRead: number
): number {
  const { in: pin, out: pout } = priceFor(model)
  return (
    (input * pin + cacheWrite * pin * 1.25 + cacheRead * pin * 0.1 + output * pout) / 1_000_000
  )
}

/* -------------------------------- parsing --------------------------------- */

const EMPTY = (cwd: string): TranscriptStats => ({
  cwd,
  found: false,
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  costUsd: 0,
  messages: 0,
  lastActivity: 0,
  pendingToolUse: false
})

interface RawLine {
  type?: string
  aiTitle?: string
  timestamp?: string
  message?: {
    model?: string
    role?: string
    usage?: {
      input_tokens?: number
      output_tokens?: number
      cache_read_input_tokens?: number
      cache_creation_input_tokens?: number
    }
    content?: unknown
  }
}

/** Does this assistant message contain a tool_use block? */
function hasToolUse(content: unknown): boolean {
  return Array.isArray(content) && content.some((b) => (b as { type?: string })?.type === 'tool_use')
}

/** Does this user message carry a tool_result (i.e. a tool call was answered)? */
function hasToolResult(content: unknown): boolean {
  return (
    Array.isArray(content) &&
    content.some((b) => (b as { type?: string })?.type === 'tool_result')
  )
}

export function readStats(cwd: string): TranscriptStats {
  const file = newestSession(cwd)
  if (!file) return EMPTY(cwd)

  let raw: string
  try {
    raw = readFileSync(file, 'utf8')
  } catch {
    return EMPTY(cwd)
  }

  const stats = EMPTY(cwd)
  stats.found = true
  stats.sessionId = path.basename(file, '.jsonl')

  let model: string | undefined
  // Whether the newest assistant turn issued a tool call that no later user
  // turn has answered — the signature of "waiting on a tool/permission".
  let pending = false

  for (const line of raw.split('\n')) {
    if (!line.trim()) continue
    let d: RawLine
    try {
      d = JSON.parse(line) as RawLine
    } catch {
      continue // a line may be half-written while the agent is mid-flush
    }

    if (d.type === 'ai-title' && d.aiTitle) stats.title = d.aiTitle
    if (d.timestamp) {
      const t = Date.parse(d.timestamp)
      if (!Number.isNaN(t)) stats.lastActivity = Math.max(stats.lastActivity, t)
    }

    const msg = d.message
    if (!msg) continue

    if (d.type === 'assistant') {
      stats.messages++
      if (msg.model) model = msg.model
      const u = msg.usage
      if (u) {
        stats.inputTokens += u.input_tokens ?? 0
        stats.outputTokens += u.output_tokens ?? 0
        stats.cacheReadTokens += u.cache_read_input_tokens ?? 0
        stats.cacheWriteTokens += u.cache_creation_input_tokens ?? 0
      }
      // An assistant turn that calls a tool leaves the agent waiting until the
      // matching result comes back on a later user turn.
      if (hasToolUse(msg.content)) pending = true
    } else if (d.type === 'user') {
      // A real user turn, or a tool result, clears any pending tool call.
      if (hasToolResult(msg.content) || typeof msg.content === 'string') pending = false
    }
  }

  stats.model = model
  stats.pendingToolUse = pending
  stats.costUsd = costUsd(
    model,
    stats.inputTokens,
    stats.outputTokens,
    stats.cacheWriteTokens,
    stats.cacheReadTokens
  )
  return stats
}

/* -------------------------------- watching -------------------------------- */

/**
 * Panes subscribe by cwd; we watch the projects root and push fresh stats to
 * the renderer whenever the matching project directory changes. One recursive
 * watch covers every session, so adding a pane costs nothing.
 */
const subscribers = new Map<string, number>() // cwd -> refcount
let watcher: ReturnType<typeof watch> | null = null
let theWindow: BrowserWindow | null = null
const debounce = new Map<string, ReturnType<typeof setTimeout>>()

function push(cwd: string): void {
  if (!theWindow || theWindow.isDestroyed()) return
  theWindow.webContents.send('transcript:stats', readStats(cwd))
}

function onChange(changedPath: string): void {
  // The event's path is relative to the projects root; its first segment is the
  // encoded project dir. Match it against every subscribed cwd's encoding.
  const first = changedPath.split(/[\\/]/)[0]
  for (const cwd of subscribers.keys()) {
    if (encodeCwd(cwd) !== first) continue
    clearTimeout(debounce.get(cwd))
    debounce.set(
      cwd,
      setTimeout(() => push(cwd), 150)
    )
  }
}

export function startTranscripts(win: BrowserWindow): void {
  theWindow = win
  try {
    watcher = watch(projectsRoot(), { recursive: true }, (_event, filename) => {
      if (filename) onChange(filename.toString())
    })
  } catch {
    // No ~/.claude/projects yet, or recursive watch unsupported — subscribing
    // still returns a one-shot snapshot; only live updates are lost.
  }
}

export function subscribeTranscript(cwd: string): TranscriptStats {
  subscribers.set(cwd, (subscribers.get(cwd) ?? 0) + 1)
  return readStats(cwd)
}

export function unsubscribeTranscript(cwd: string): void {
  const n = (subscribers.get(cwd) ?? 0) - 1
  if (n <= 0) subscribers.delete(cwd)
  else subscribers.set(cwd, n)
}

export function stopTranscripts(): void {
  watcher?.close()
  watcher = null
  for (const t of debounce.values()) clearTimeout(t)
  debounce.clear()
}

/* ---------------------------- conversation list --------------------------- */

/** First text block from a message's content, whichever role wrote it. */
function firstText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    for (const b of content) {
      const bb = b as { type?: string; text?: string }
      if (bb?.type === 'text' && bb.text) return bb.text
    }
  }
  return ''
}

/** Collapse whitespace and clip, so a "left off" line stays one tidy row. */
function clip(s: string, n = 120): string {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n - 1)}…` : t
}

interface ConvoLine extends RawLine {
  cwd?: string
}

function parseConversation(file: string, mtime: number): ConversationInfo | null {
  let raw: string
  try {
    raw = readFileSync(file, 'utf8')
  } catch {
    return null
  }

  let title = ''
  let firstUser = ''
  let lastText = ''
  let cwd = ''
  let model: string | undefined
  let messages = 0
  let last = 0
  let pending = false

  for (const line of raw.split('\n')) {
    if (!line.trim()) continue
    let d: ConvoLine
    try {
      d = JSON.parse(line) as ConvoLine
    } catch {
      continue
    }

    if (d.type === 'ai-title' && d.aiTitle) title = d.aiTitle
    if (typeof d.cwd === 'string' && d.cwd) cwd = d.cwd
    if (d.timestamp) {
      const t = Date.parse(d.timestamp)
      if (!Number.isNaN(t)) last = Math.max(last, t)
    }

    const msg = d.message
    if (!msg) continue

    if (d.type === 'assistant') {
      messages++
      if (msg.model) model = msg.model
      const txt = firstText(msg.content)
      if (txt) lastText = txt
      if (hasToolUse(msg.content)) pending = true
    } else if (d.type === 'user') {
      if (hasToolResult(msg.content) || typeof msg.content === 'string') pending = false
      const txt = firstText(msg.content)
      // A tool_result turn has no prose; only keep genuine user text.
      if (txt && !hasToolResult(msg.content)) {
        if (!firstUser) firstUser = txt
        lastText = txt
      }
    }
  }

  const updated = last || mtime
  const label = title || clip(firstUser, 48) || (cwd ? path.basename(cwd) : '') || 'session'
  const leftOff = pending ? 'waiting on a tool — needs you' : clip(lastText) || 'no messages yet'

  return {
    sessionId: path.basename(file, '.jsonl'),
    cwd,
    title: label,
    updated,
    leftOff,
    pendingToolUse: pending,
    messages,
    model
  }
}

/**
 * Every recent Claude Code session across all projects, newest first — what the
 * conversations pane renders. Reads only the most recent `limit` transcripts (by
 * file mtime) so a long history doesn't make this expensive.
 */
export function listConversations(limit = 25): ConversationInfo[] {
  const root = projectsRoot()
  const files: { file: string; mtime: number }[] = []

  let dirs: string[]
  try {
    dirs = readdirSync(root)
  } catch {
    return [] // no ~/.claude/projects yet
  }

  for (const d of dirs) {
    const dir = path.join(root, d)
    let names: string[]
    try {
      names = readdirSync(dir)
    } catch {
      continue
    }
    for (const n of names) {
      if (!n.endsWith('.jsonl')) continue
      const full = path.join(dir, n)
      try {
        files.push({ file: full, mtime: statSync(full).mtimeMs })
      } catch {
        /* vanished between readdir and stat */
      }
    }
  }

  files.sort((a, b) => b.mtime - a.mtime)

  const out: ConversationInfo[] = []
  for (const { file, mtime } of files.slice(0, limit)) {
    const info = parseConversation(file, mtime)
    // Skip empty shells (a session that only ever printed its banner).
    if (info && (info.messages > 0 || info.leftOff !== 'no messages yet')) out.push(info)
  }
  out.sort((a, b) => b.updated - a.updated)
  return out
}
