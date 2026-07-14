import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SerializeAddon } from '@xterm/addon-serialize'
import { registerScrollback, unregisterScrollback } from '../scrollback'
import { takePort } from '../ptyPorts'
import { useStore, type Pane } from '../store'
import { commandTitle, isAgentCommand, topicTitle } from '../titles'
import '@xterm/xterm/css/xterm.css'

const THEME = {
  background: '#0d1117',
  foreground: '#c9d1d9',
  cursor: '#58a6ff',
  selectionBackground: '#264f78',
  black: '#484f58',
  red: '#ff7b72',
  green: '#3fb950',
  yellow: '#d29922',
  blue: '#58a6ff',
  magenta: '#bc8cff',
  cyan: '#39c5cf',
  white: '#b1bac4',
  brightBlack: '#6e7681',
  brightRed: '#ffa198',
  brightGreen: '#56d364',
  brightYellow: '#e3b341',
  brightBlue: '#79c0ff',
  brightMagenta: '#d2a8ff',
  brightCyan: '#56d4dd',
  brightWhite: '#f0f6fc'
}

interface Props {
  wsId: string
  tabId: string
  pane: Pane
  focused: boolean
}

export function TerminalPane({ wsId, tabId, pane, focused }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)

  // Read these from the store imperatively; putting them in the effect's dep
  // array would tear down and respawn the PTY on every unrelated re-render.
  const updatePane = useStore((s) => s.updatePane)
  const setActivePane = useStore((s) => s.setActivePane)
  const autoNamePane = useStore((s) => s.autoNamePane)
  const setPaneStatus = useStore((s) => s.setPaneStatus)
  const raiseAttentionFor = useStore((s) => s.raiseAttention)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let disposed = false
    let ptyId: string | null = null
    let port: MessagePort | null = null

    const term = new Terminal({
      fontFamily: '"Cascadia Mono", "JetBrains Mono", Consolas, "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.2,
      theme: THEME,
      cursorBlink: true,
      scrollback: 10_000,
      // Any smooth-scroll animation is pure added latency on output.
      smoothScrollDuration: 0,
      allowProposedApi: true
    })
    termRef.current = term

    const fit = new FitAddon()
    term.loadAddon(fit)
    term.loadAddon(new WebLinksAddon())

    // Lets the session survive a restart: persistence asks this for the pane's
    // buffer, and we replay whatever it saved last time (below).
    const serializer = new SerializeAddon()
    term.loadAddon(serializer)

    term.open(host)

    registerScrollback(pane.id, () => serializer.serialize({ scrollback: 1200 }))

    // WebGL is the reason large outputs stay smooth. It can fail on some GPUs /
    // in software rendering, in which case xterm silently falls back to canvas.
    try {
      const webgl = new WebglAddon()
      webgl.onContextLoss(() => webgl.dispose())
      term.loadAddon(webgl)
    } catch {
      /* fall back to the DOM/canvas renderer */
    }

    try {
      fit.fit()
    } catch {
      // Host has no size yet; the ResizeObserver below will fit it once it does.
    }

    /*
     * Replay the previous session's buffer, so the pane comes back holding what
     * it held when you quit. This is history, not a live process: the shell
     * below is brand new, and an agent that was mid-thought when you closed the
     * app is not resumed by painting its words back.
     *
     * The trailing newlines are load-bearing. ConPTY opens by sending ESC[2J,
     * which erases whatever is on the visible grid — i.e. precisely what we just
     * wrote. Scrolling the history up into the scrollback buffer first puts it
     * out of reach: 2J clears the screen, and ConPTY never sends 3J (which is
     * what would clear scrollback). The pane therefore opens on a clean prompt
     * with the previous session sitting directly above it.
     */
    if (pane.scrollback) {
      term.write(pane.scrollback)
      term.write('\r\n\x1b[90m── restored from previous session ──\x1b[0m\r\n')
      term.write('\n'.repeat(term.rows))
    }

    // cmux-style attention signals: an agent that wants you raises OSC 9 or
    // OSC 777, and most CLIs ring the bell when they need input.
    const raiseAttention = () => {
      if (!disposed) raiseAttentionFor(wsId, tabId, pane.id)
    }
    term.parser.registerOscHandler(9, () => {
      raiseAttention()
      return true
    })
    term.parser.registerOscHandler(777, () => {
      raiseAttention()
      return true
    })
    term.onBell(raiseAttention)

    /*
     * Working / finished indicator.
     *
     * There's no API that tells us an agent is thinking, so we infer it from the
     * PTY: output flowing means work is happening; output stopping means it has
     * stopped. For an agent pane, going quiet means it's finished and waiting on
     * you ("finished"); for a plain shell it just means we're back at a prompt
     * ("idle").
     *
     * QUIET_MS has to clear the gaps an agent leaves while streaming tokens or
     * running a tool, or the indicator flickers between working and finished.
     */
    const QUIET_MS = 1200
    let status: 'idle' | 'working' | 'finished' = 'idle'
    let quietTimer: ReturnType<typeof setTimeout> | undefined

    // Name of the agent CLI running here, or null for a plain shell. Set either
    // by the pane's initial command (worktree panes) or by the input sniffer
    // below when you type `claude` yourself. Drives both naming and status.
    let agent: string | null =
      pane.initialCommand && isAgentCommand(pane.initialCommand)
        ? pane.initialCommand.trim().split(/\s+/)[0]
        : null

    const setStatus = (next: typeof status) => {
      if (disposed || status === next) return
      status = next
      // The store decides whether this counts as "unseen" — it's the only thing
      // that knows which tab is on screen.
      setPaneStatus(wsId, tabId, pane.id, next)
    }

    const markOutput = () => {
      setStatus('working')
      clearTimeout(quietTimer)
      quietTimer = setTimeout(() => setStatus(agent ? 'finished' : 'idle'), QUIET_MS)
    }

    /*
     * Smart naming. We reconstruct the line you're typing from the keystrokes
     * on their way to the PTY, and name the pane from it when you hit Enter.
     *
     * Before an agent starts, a line is a shell command -> "npm dev", "git log".
     * Once an agent CLI is running, a line is prose you're saying to it, so the
     * name becomes the topic instead -> "claude: add dark mode".
     */
    let line = ''
    let inEscape = false

    const sniff = (chunk: string) => {
      for (const ch of chunk) {
        // Arrow keys and friends arrive as escape sequences; they'd otherwise
        // land in the buffer as stray "[A" garbage.
        if (inEscape) {
          if (/[a-zA-Z~]/.test(ch)) inEscape = false
          continue
        }
        if (ch === '\x1b') {
          inEscape = true
          continue
        }

        if (ch === '\r' || ch === '\n') {
          const submitted = line.trim()
          line = ''
          if (!submitted) continue

          if (agent) {
            const topic = topicTitle(submitted)
            if (topic) autoNamePane(wsId, tabId, pane.id, `${agent}: ${topic}`)
          } else {
            const title = commandTitle(submitted)
            if (title) autoNamePane(wsId, tabId, pane.id, title)
            if (isAgentCommand(submitted)) {
              agent = submitted.split(/\s+/)[0]
              updatePane(wsId, tabId, pane.id, { agent: true })
            }
          }
          // You pressed Enter — whatever you asked for is now underway.
          setStatus('working')
        } else if (ch === '\x7f' || ch === '\b') {
          line = line.slice(0, -1)
        } else if (ch === '\x03' || ch === '\x15') {
          line = '' // Ctrl+C / Ctrl+U discard the line
        } else if (ch >= ' ') {
          line += ch
        }
      }
    }

    if (pane.initialCommand) {
      const title = commandTitle(pane.initialCommand)
      if (title) autoNamePane(wsId, tabId, pane.id, title)
    }

    ;(async () => {
      const id = await window.claudify.createTerminal({
        cwd: pane.cwd,
        cols: term.cols,
        rows: term.rows,
        initialCommand: pane.initialCommand
      })
      if (disposed) {
        window.claudify.killTerminal(id).catch(() => {})
        return
      }
      ptyId = id
      const p = await takePort(id)
      if (disposed) {
        window.claudify.killTerminal(id).catch(() => {})
        return
      }
      port = p

      // ---- the hot path ----
      // Output: PTY -> MessagePort -> xterm. Input: xterm -> MessagePort -> PTY.
      // Neither direction touches React or ipcRenderer, so a keystroke costs one
      // structured-clone hop and nothing else.
      p.onmessage = (e: MessageEvent) => {
        const data = e.data as string | { t: 'exit'; code: number }
        if (typeof data === 'string') {
          term.write(data)
          markOutput()
        } else if (data?.t === 'exit') {
          term.write(`\r\n\x1b[90m[process exited with code ${data.code}]\x1b[0m\r\n`)
          if (!disposed) {
            clearTimeout(quietTimer)
            setStatus('idle')
            updatePane(wsId, tabId, pane.id, { exited: true })
          }
        }
      }
      p.start()
      term.onData((d) => {
        p.postMessage(d)
        sniff(d)
      })
      term.focus()
    })()

    const resize = () => {
      if (disposed) return
      try {
        fit.fit()
      } catch {
        return // host has zero size (pane is hidden mid-layout)
      }
      port?.postMessage({ t: 'resize', cols: term.cols, rows: term.rows })
    }

    const ro = new ResizeObserver(resize)
    ro.observe(host)

    return () => {
      disposed = true
      clearTimeout(quietTimer)
      unregisterScrollback(pane.id)
      ro.disconnect()
      try {
        port?.close()
      } catch {
        /* already closed */
      }
      if (ptyId) window.claudify.killTerminal(ptyId).catch(() => {})
      term.dispose()
      termRef.current = null
    }
    // Spawn exactly once per pane. pane.cwd/initialCommand are fixed at creation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pane.id])

  useEffect(() => {
    if (focused) termRef.current?.focus()
  }, [focused])

  return (
    <div className="term-host" ref={hostRef} onMouseDown={() => setActivePane(wsId, tabId, pane.id)} />
  )
}
