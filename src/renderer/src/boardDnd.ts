/**
 * Drag-to-reorder for the dashboard's board tabs (todo topics, notepad pages).
 *
 * Kept separate from the terminal tab drag: those move panes between workspaces
 * and must not be confused with these, which only reorder a list inside one
 * pane. Distinct MIME types mean a topic can never be dropped on the tab bar,
 * and a terminal tab can never be dropped on the todo pane.
 */
export const TOPIC_MIME = 'application/x-claudify-topic'
export const NOTE_MIME = 'application/x-claudify-note'

/** Move `from` to `to`, returning a new array. */
export function reorder<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= items.length) return items
  const next = [...items]
  const [moved] = next.splice(from, 1)
  next.splice(Math.max(0, Math.min(to, next.length)), 0, moved)
  return next
}

/**
 * Where a drop lands, given the pointer and the tab it was dropped on: before it
 * if you're on its left half, after it if you're on its right. Without this,
 * dragging a tab one place to the right does nothing — it lands back on itself.
 */
export function dropIndex(box: DOMRect, clientX: number, index: number): number {
  return clientX > box.left + box.width / 2 ? index + 1 : index
}
