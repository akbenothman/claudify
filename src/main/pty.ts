import { spawn, type IPty } from '@lydell/node-pty'
import type { MessagePortMain } from 'electron'
import type { PtySpawnOptions } from '../shared/types'
import { getSettings } from './persist'
import { resolveShell } from './shells'

/**
 * Control messages ride the same MessagePort as terminal bytes. The hot path
 * (keystrokes in, output out) sends bare strings, so distinguishing the two is
 * a single `typeof` check rather than a wrapper object allocation per keypress.
 */
type ControlToMain = { t: 'resize'; cols: number; rows: number }
type ControlToRenderer = { t: 'exit'; code: number } | { t: 'title'; title: string }

interface Session {
  id: string
  pty: IPty
  port: MessagePortMain
}

const sessions = new Map<string, Session>()
let nextId = 1

/**
 * Spawns a PTY and wires it directly to `port`.
 *
 * Everything after this call bypasses the main<->renderer IPC router: bytes
 * move over the MessagePort, so a keystroke never touches React or
 * `ipcRenderer`. This is the whole reason input feels immediate.
 */
export function createSession(opts: PtySpawnOptions, port: MessagePortMain): string {
  const id = `pty-${nextId++}`
  // The user's chosen shell, unless this call names one explicitly.
  const configured = resolveShell(getSettings().shellId)
  const shell = opts.shell || configured.path
  const args = opts.args ?? (opts.shell ? [] : configured.args)

  const pty = spawn(shell, args, {
    name: 'xterm-256color',
    cwd: opts.cwd,
    cols: Math.max(2, opts.cols),
    rows: Math.max(1, opts.rows),
    env: {
      ...(process.env as Record<string, string>),
      ...(opts.env ?? {}),
      TERM: 'xterm-256color',
      // Lets a Claude running inside a pane detect (and later, address) its host.
      CLAUDIFY_PANE: id
    }
  })

  const toRenderer = (msg: ControlToRenderer) => port.postMessage(msg)

  let launched = !opts.initialCommand
  pty.onData((data) => {
    port.postMessage(data)
    if (!launched) {
      // Wait for the shell to emit its first output (i.e. it has drawn a
      // prompt) before typing into it, otherwise the command is swallowed.
      launched = true
      setTimeout(() => {
        try {
          pty.write(`${opts.initialCommand}\r`)
        } catch {
          /* session may have died in the interim */
        }
      }, 120)
    }
  })

  pty.onExit(({ exitCode }) => {
    toRenderer({ t: 'exit', code: exitCode })
    sessions.delete(id)
    try {
      port.close()
    } catch {
      /* already closed */
    }
  })

  port.on('message', (event) => {
    const msg = event.data as string | ControlToMain
    try {
      if (typeof msg === 'string') {
        pty.write(msg)
      } else if (msg && msg.t === 'resize') {
        pty.resize(Math.max(2, msg.cols), Math.max(1, msg.rows))
      }
    } catch {
      // Writing to a dead PTY throws; the exit handler already cleaned up.
    }
  })
  port.start()

  sessions.set(id, { id, pty, port })
  return id
}

export function killSession(id: string): void {
  const s = sessions.get(id)
  if (!s) return
  try {
    s.pty.kill()
  } catch {
    /* already gone */
  }
  sessions.delete(id)
}

export function killAll(): void {
  for (const id of [...sessions.keys()]) killSession(id)
}
