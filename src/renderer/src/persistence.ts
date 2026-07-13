import { serialize, useStore } from './store'

const DEBOUNCE_MS = 400

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

  const flush = () => {
    if (!dirty) return
    dirty = false
    window.claudify.saveSession(serialize(useStore.getState())).catch(() => {
      /* nothing useful to do if the disk write fails */
    })
  }

  useStore.subscribe(() => {
    dirty = true
    clearTimeout(timer)
    timer = setTimeout(flush, DEBOUNCE_MS)
  })

  window.addEventListener('beforeunload', () => {
    clearTimeout(timer)
    flush()
  })
}
