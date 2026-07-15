/**
 * A tiny registry of "write into this pane" functions, keyed by pane id.
 *
 * Terminal input normally lives entirely inside a TerminalPane (keystroke →
 * MessagePort → PTY). But the control surface needs to type into a pane from
 * the outside — an agent asking claudify to run a command in another pane — so
 * each mounted terminal publishes its writer here, and code elsewhere can reach
 * it without threading a port through the store. Same shape as scrollback.ts.
 */

const writers = new Map<string, (data: string) => void>()

export function registerInput(paneId: string, write: (data: string) => void): void {
  writers.set(paneId, write)
}

export function unregisterInput(paneId: string): void {
  writers.delete(paneId)
}

/** Type text into a pane and press Enter. Returns false if the pane is gone. */
export function sendToPane(paneId: string, text: string): boolean {
  const write = writers.get(paneId)
  if (!write) return false
  write(`${text}\r`)
  return true
}
