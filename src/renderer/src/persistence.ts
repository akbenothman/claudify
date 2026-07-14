import { serialize, useStore } from './store'
import { peekScrollback, snapshotScrollback } from './scrollback'
import type { Session } from '../../shared/types'

const DEBOUNCE_MS = 400

/**
 * Folds each mounted terminal's live buffer into the session.
 *
 * `serialize` is a pure function of the store, and the store deliberately does
 * not hold terminal output — so the text is fetched here, from the panes
 * themselves. A pane that hasn't mounted yet has no live buffer; it keeps the
 * scrollback it was restored with rather than being blanked.
 */
function withScrollback(session: Session, capture: boolean, force: boolean): Session {
  const take = (p: Session['workspaces'][number]['tabs'][number]['panes'][number]) => {
    // Only re-read the terminals when we mean to (the sweep, and shutdown).
    // Otherwise reuse the last snapshot: serializing every buffer on the
    // keystroke path is what made typing lag.
    const live = capture ? snapshotScrollback(p.id, force) : peekScrollback(p.id)
    /*
     * An empty buffer is never worth saving, and on boot it is actively
     * harmful: a pane that has mounted but not yet been painted serializes to
     * "", which would overwrite the very history we just restored. Keep what we
     * have until the terminal has something to say.
     */
    return live && live.trim() ? live : p.scrollback
  }

  return {
    ...session,
    workspaces: session.workspaces.map((w) => ({
      ...w,
      tabs: w.tabs.map((t) => ({
        ...t,
        panes: t.panes.map((p) => (p.kind === 'terminal' ? { ...p, scrollback: take(p) } : p))
      }))
    }))
  }
}

/**
 * Mirrors the workspace tree to disk whenever it changes.
 *
 * Debounced, because dragging a divider fires a store update per pointer move
 * and we don't want to rewrite the file a hundred times a second. Also flushes
 * synchronously-ish on window close, so the last change before you shut the PC
 * down isn't the one that gets lost.
 */
export function startPersistence(): void {
  let timer: ReturnType<typeof setTimeout> | undefined
  let dirty = false
  let lastWritten = ''

  /**
   * `capture` re-reads the terminals; without it we reuse the last snapshot.
   * Store-change saves never capture — pressing a key flips a pane's status,
   * which is a store change, and serializing every buffer on that path is a
   * lot of work to do between a keystroke and its echo.
   */
  const flush = ({ capture = false, sync = false } = {}) => {
    if (!dirty && !capture) return
    dirty = false

    const session = withScrollback(serialize(useStore.getState()), capture, sync)

    // Identical writes are worth skipping: with scrollback reused rather than
    // re-serialized, a burst of typing produces the same session object every
    // time, and this turns those saves into nothing at all.
    const json = JSON.stringify(session)
    if (json === lastWritten) return
    lastWritten = json

    if (sync) {
      window.claudify.saveSessionNow(session)
      return
    }
    window.claudify.saveSession(session).catch(() => {
      /* nothing useful to do if the disk write fails */
    })
  }

  useStore.subscribe(() => {
    dirty = true
    clearTimeout(timer)
    timer = setTimeout(() => flush(), DEBOUNCE_MS)
  })

  /*
   * Terminal output does not touch the store, so a pane that is busy printing
   * produces no store updates and would never be saved. Sweep on a timer to
   * catch it, and take a final, uncached snapshot on the way out.
   */
  const sweep = setInterval(() => flush({ capture: true }), 10_000)

  window.addEventListener('beforeunload', () => {
    clearTimeout(timer)
    clearInterval(sweep)
    flush({ capture: true, sync: true })
  })
}
