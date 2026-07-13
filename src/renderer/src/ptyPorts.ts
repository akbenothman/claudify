const PORT_TAG = 'claudify:pty-port'

/** Ports that arrived before their terminal asked for them. */
const arrived = new Map<string, MessagePort>()
const waiting = new Map<string, (p: MessagePort) => void>()

window.addEventListener('message', (e: MessageEvent) => {
  // Only trust ports the preload re-posted into this world.
  if (e.source !== window) return
  const data = e.data as { tag?: string; id?: string } | null
  if (!data || data.tag !== PORT_TAG || !data.id) return

  const port = e.ports[0]
  if (!port) return

  const waiter = waiting.get(data.id)
  if (waiter) {
    waiting.delete(data.id)
    waiter(port)
  } else {
    arrived.set(data.id, port)
  }
})

/** Resolves with the MessagePort bound to PTY `id`, whenever it shows up. */
export function takePort(id: string): Promise<MessagePort> {
  const early = arrived.get(id)
  if (early) {
    arrived.delete(id)
    return Promise.resolve(early)
  }
  return new Promise((resolve) => waiting.set(id, resolve))
}
