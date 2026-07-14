import { serialize, useStore } from './store'
import { snapshotScrollback } from './scrollback'
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
function withScrollback(session: Session, force: boolean): Session {
  const capture = (p: Session['workspaces'][number]['tabs'][number]['panes'][number]) => {
    const live = snapshotScrollback(p.id, force)
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
        panes: t.panes.map((p) =>
          p.kind === 'terminal' ? { ...p, scrollback: capture(p) } : p
        )
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

  const flush = (force = false) => {
    if (!dirty && !force) return
    dirty = false

    const session = withScrollback(serialize(useStore.getState()), force)

    // The sweep below runs whether or not anything happened. Skipping identical
    // writes keeps an idle app from rewriting a megabyte of scrollback forever.
    const json = JSON.stringify(session)
    if (json === lastWritten) return
    lastWritten = json

    window.claudify.saveSession(session).catch(() => {
      /* nothing useful to do if the disk write fails */
    })
  }

  useStore.subscribe(() => {
    dirty = true
    clearTimeout(timer)
    timer = setTimeout(flush, DEBOUNCE_MS)
  })

  /*
   * Terminal output does not touch the store, so a pane that is busy printing
   * produces no store updates and would never be saved. Sweep on a timer to
   * catch it, and take a final, uncached snapshot on the way out.
   */
  const sweep = setInterval(() => flush(true), 10_000)

  window.addEventListener('beforeunload', () => {
    clearTimeout(timer)
    clearInterval(sweep)
    flush(true)
  })
}
