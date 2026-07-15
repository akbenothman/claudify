/**
 * Live terminal font size, shared across every open pane.
 *
 * `Settings.fontSize` is the persisted value; this is the in-memory mirror that
 * mounted terminals subscribe to, so Ctrl+= / Ctrl+- resize every pane at once
 * without respawning a single PTY. The setter also writes the value back to
 * settings so it survives a restart.
 */
type Fn = (n: number) => void

const MIN = 8
const MAX = 28
const DEFAULT = 13

let fontSize = DEFAULT
const subs = new Set<Fn>()

const clamp = (n: number): number => Math.max(MIN, Math.min(MAX, Math.round(n)))

export const getFontSize = (): number => fontSize

/** Seed from persisted settings at boot. Does not write back to disk. */
export function initFontSize(n: number | undefined): void {
  if (n) fontSize = clamp(n)
  subs.forEach((f) => f(fontSize))
}

export function setFontSize(n: number): void {
  const next = clamp(n)
  if (next === fontSize) return
  fontSize = next
  subs.forEach((f) => f(fontSize))
  window.claudify.saveSettings({ fontSize }).catch(() => {})
}

export const bumpFontSize = (delta: number): void => setFontSize(fontSize + delta)
export const resetFontSize = (): void => setFontSize(DEFAULT)

export function subscribeFontSize(f: Fn): () => void {
  subs.add(f)
  return () => {
    subs.delete(f)
  }
}
