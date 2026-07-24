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

const isCmd = (shellPath: string): boolean => /(^|[\\/])cmd\.exe$/i.test(shellPath)

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

  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    ...(opts.env ?? {}),
    TERM: 'xterm-256color',
    // Claudify's xterm is a full truecolor display, so advertise it the way every
    // real terminal emulator (Windows Terminal, iTerm) does. Without COLORTERM,
    // chalk / supports-color — which Claude Code's TUI and statusline plugins run
    // on — drop to a lower colour level.
    COLORTERM: 'truecolor',
    // Lets a Claude running inside a pane detect (and later, address) its host.
    CLAUDIFY_PANE: id
  }

  /*
   * A NO_COLOR (or FORCE_COLOR=0) inherited from however Claudify itself was
   * launched turns every colour in the pane off — a fully monochrome Claude TUI,
   * spinner glyph and statusline included. NO_COLOR is a display instruction and
   * the pane is a colour-capable display, so it isn't the launching shell's to
   * give: undo it here rather than let it leak into the shell we start.
   */
  delete env.NO_COLOR
  if (env.FORCE_COLOR === '0') delete env.FORCE_COLOR

  /*
   * Two things wrong with cmd's default prompt, both fixed here.
   *
   * It renders `C:\dir>` with nothing after the `>`, so what you type collides
   * with the path — `$S` is cmd's escape for a space.
   *
   * And it never says where it is, so a `cd` is invisible to us and a new tab
   * would open in the directory the shell STARTED in. The `$E]9;9;<path>$E\`
   * preamble is Windows Terminal's convention for reporting the working
   * directory; the renderer listens for it (see the OSC 9 handler) and follows
   * the shell as it moves.
   *
   * The user's own PROMPT is preserved if they set one — we only add to it.
   */
  if (isCmd(shell)) {
    const base = env.PROMPT || '$P$G'
    const spaced = /\$s$/i.test(base) ? base : `${base}$S`
    env.PROMPT = spaced.includes('$E]9;9;') ? spaced : `$E]9;9;$P$E\\${spaced}`
  }

  const pty = spawn(shell, args, {
    name: 'xterm-256color',
    cwd: opts.cwd,
    cols: Math.max(2, opts.cols),
    rows: Math.max(1, opts.rows),
    env
  })

  const toRenderer = (msg: ControlToRenderer) => port.postMessage(msg)

  /*
   * Auto-answer Claude Code's "Do you trust the files in this folder?" dialog.
   *
   * Every time `claude` starts in a directory it hasn't seen before it puts up a
   * trust prompt whose default option is "Yes, proceed", cleared with Enter.
   * For panes claudify opens itself (a new workspace, a worktree task) that's a
   * dialog the user never asked for and shouldn't have to clear. We watch the
   * output for the prompt over a small rolling window (ANSI redraws mean it can
   * arrive in pieces) and press Enter once, shortly after it appears.
   */
  let trustBuf = ''
  let trustDone = !opts.autoConfirmTrust
  const TRUST_RE = /trust the files in this folder/i
  const watchTrust = (data: string): void => {
    if (trustDone) return
    trustBuf = (trustBuf + data).slice(-4096)
    if (!TRUST_RE.test(trustBuf)) return
    trustDone = true
    trustBuf = ''
    setTimeout(() => {
      try {
        pty.write('\r')
      } catch {
        /* session may have died in the interim */
      }
    }, 200)
  }

  let launched = !opts.initialCommand
  pty.onData((data) => {
    port.postMessage(data)
    watchTrust(data)
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
