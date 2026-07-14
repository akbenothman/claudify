/**
 * Live scrollback snapshots, keyed by pane id.
 *
 * Each mounted TerminalPane registers a function that serializes its xterm
 * buffer; the persistence layer calls them when it mirrors the session to disk.
 * Going through a registry (rather than putting the text in the store) keeps the
 * terminal's bytes out of React state, where every chunk of output would
 * re-render the app.
 *
 * We snapshot the *rendered buffer*, not the raw PTY stream. Replaying a raw
 * stream would re-run every control sequence the session ever emitted — alt
 * screen switches, clears, cursor jumps — and a TUI like Claude's would come
 * back scrambled. The buffer is what you were actually looking at.
 */

type Snapshot = () => string

interface Entry {
  take: Snapshot
  /** Last snapshot and when we took it; serializing 1k lines isn't free. */
  cached?: string
  at?: number
}

const panes = new Map<string, Entry>()

/** Serializing on every store change would be wasteful — output panes churn. */
const CACHE_MS = 4000

/** Roughly 1–2k lines of coloured text. Big enough to be useful, small enough
 *  that a dozen panes don't bloat the state file into megabytes. */
const MAX_CHARS = 120_000

export function registerScrollback(paneId: string, take: Snapshot): void {
  panes.set(paneId, { take })
}

export function unregisterScrollback(paneId: string): void {
  panes.delete(paneId)
}

/** Trim to the last MAX_CHARS, cutting at a line boundary so the restored
 *  buffer never opens mid-escape-sequence. */
function clamp(text: string): string {
  if (text.length <= MAX_CHARS) return text
  const tail = text.slice(text.length - MAX_CHARS)
  const nl = tail.indexOf('\n')
  return nl === -1 ? tail : tail.slice(nl + 1)
}

/**
 * Current scrollback for a pane, or undefined if it isn't mounted.
 * `force` bypasses the cache — used on the final save during shutdown, where
 * a 4-second-stale buffer would drop whatever just happened.
 */
export function snapshotScrollback(paneId: string, force = false): string | undefined {
  const entry = panes.get(paneId)
  if (!entry) return undefined

  const now = Date.now()
  if (!force && entry.cached !== undefined && entry.at !== undefined && now - entry.at < CACHE_MS) {
    return entry.cached
  }

  try {
    const text = clamp(entry.take())
    entry.cached = text
    entry.at = now
    return text
  } catch {
    // A disposed terminal throws rather than returning empty. Keep the last
    // good snapshot instead of erasing the pane's history.
    return entry.cached
  }
}
