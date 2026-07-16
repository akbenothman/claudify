import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SerializeAddon } from '@xterm/addon-serialize'
import { SearchAddon } from '@xterm/addon-search'
import { registerScrollback, unregisterScrollback } from '../scrollback'
import { registerInput, unregisterInput } from '../paneInput'
import { registerSearch, unregisterSearch } from '../paneSearch'
import { getFontSize, subscribeFontSize } from '../termPrefs'
import { takePort } from '../ptyPorts'
import { useStore, type Pane, type PaneStatus } from '../store'
import { agentPrompt, commandTitle, isAgentCommand, topicTitle } from '../titles'
import type { TranscriptStats } from '../../../shared/types'
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
      fontSize: getFontSize(),
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

    // Scrollback search (Ctrl+Shift+F). The global search bar reaches this
    // through the search registry, so the UI never touches xterm directly.
    const search = new SearchAddon()
    term.loadAddon(search)

    term.open(host)

    registerScrollback(pane.id, () => serializer.serialize({ scrollback: 1200 }))

    const searchDecorations = {
      matchBackground: '#3f2d00',
      matchOverviewRuler: '#d29922',
      activeMatchBackground: '#58a6ff',
      activeMatchColorOverviewRuler: '#58a6ff'
    }
    registerSearch(pane.id, {
      findNext: (q) => search.findNext(q, { decorations: searchDecorations }),
      findPrevious: (q) => search.findPrevious(q, { decorations: searchDecorations }),
      clear: () => search.clearDecorations()
    })

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
    /*
     * OSC 9 carries two different things on Windows. `ESC ] 9 ; <text>` is the
     * notification an agent raises when it wants you. `ESC ] 9 ; 9 ; <path>` is
     * Windows Terminal's convention for "my working directory is now this",
     * which our cmd prompt emits (see PROMPT in pty.ts). Same opcode, so the
     * payload has to be told apart here — otherwise every prompt would flash the
     * attention ring.
     */
    term.parser.registerOscHandler(9, (data) => {
      const cwd = /^9;(.+)$/.exec(data)?.[1]
      if (cwd) {
        // Follows `cd`, so a new tab or split opens where you actually are.
        if (!disposed) updatePane(wsId, tabId, pane.id, { cwd: cwd.trim() })
        return true
      }
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
     *
     * But bytes arriving is NOT the same as work happening. A TUI like Claude's
     * repaints itself on a timer — the footer, the hint line, the cursor — and
     * an idle agent therefore dribbles output forever. Taking that at face value
     * flashed the dot blue and then green again, over and over, for an agent
     * that had been done for ten minutes.
     *
     * So we require the SCREEN to have changed, not merely the byte count: hold
     * the "working" claim for WORK_DELAY_MS, then compare what's on the grid
     * against how it looked when we last settled. A repaint of identical content
     * is not work, and is now correctly ignored. A spinner tick changes a glyph,
     * so genuine activity still registers.
     */
    const QUIET_MS = 1200
    const WORK_DELAY_MS = 250
    let status: PaneStatus = 'idle'
    let quietTimer: ReturnType<typeof setTimeout> | undefined
    let workTimer: ReturnType<typeof setTimeout> | undefined

    /** What the visible grid says right now. Cheap: rows, not scrollback. */
    const screen = (): string => {
      const buf = term.buffer.active
      let out = ''
      for (let i = 0; i < term.rows; i++) {
        out += buf.getLine(buf.viewportY + i)?.translateToString(true) ?? ''
        out += '\n'
      }
      return out
    }

    /** The screen as of the last time this pane went quiet. */
    let settled = ''

    // Name of the agent CLI running here, or null for a plain shell. Set either
    // by the pane's initial command (worktree panes) or by the input sniffer
    // below when you type `claude` yourself. Drives both naming and status.
    let agent: string | null =
      pane.initialCommand && isAgentCommand(pane.initialCommand)
        ? pane.initialCommand.trim().split(/\s+/)[0]
        : null

    /*
     * Has this agent actually been ASKED for anything?
     *
     * "Finished" is a claim that something you wanted is now done and waiting on
     * you — it lights the tab green and counts as unchecked. An agent that has
     * merely been launched has finished nothing: the dashboard's Claude boots,
     * paints its prompt, goes quiet, and used to announce itself as a job you
     * hadn't checked, in a pane where you had never typed a thing.
     *
     * A worktree pane is the opposite case: it starts with a task on the command
     * line (`claude "add dark mode"`), so it IS working for you from birth. A
     * bare `claude` with no argument is not.
     */
    // A worktree pane starts with a real prompt (`claude "add dark mode"`); the
    // dashboard/new-workspace Claude starts bare (just `claude`, plus our
    // --mcp-config flag, which is NOT a task). agentPrompt tells them apart.
    const startedOnATask = !!pane.initialCommand && !!agentPrompt(pane.initialCommand)
    let asked = startedOnATask

    const setStatus = (next: typeof status) => {
      if (disposed || status === next) return
      status = next
      // The store decides whether this counts as "unseen" — it's the only thing
      // that knows which tab is on screen.
      setPaneStatus(wsId, tabId, pane.id, next)
    }

    /*
     * Latest read of this pane's Claude Code transcript. When the agent has gone
     * quiet, this tells "finished" apart from "blocked": a turn that ended on an
     * unanswered tool call is waiting on you to approve something, not done.
     */
    let stats: TranscriptStats | null = null

    /** The your-turn state once an asked agent has gone quiet. */
    const restState = (): typeof status =>
      agent && asked ? (stats?.pendingToolUse ? 'blocked' : 'finished') : 'idle'

    const settle = () => {
      clearTimeout(workTimer)
      workTimer = undefined
      settled = screen()
      setStatus(restState())
    }

    /*
     * The transcript is the pane's launch directory — Claude Code writes its
     * session log against the cwd it started in, and stays there. Subscribing is
     * cheap even for a plain shell (it just reports found:false).
     */
    const transcriptCwd = pane.cwd
    const applyStats = (s: TranscriptStats) => {
      if (disposed || s.cwd !== transcriptCwd) return
      stats = s
      updatePane(wsId, tabId, pane.id, { stats: s })
      // A permission prompt appears in the transcript without any new bytes on
      // screen, so a pane that already settled to "finished" must be able to
      // flip to "blocked" when the transcript says a tool is pending. Only for
      // agent panes, though — a plain shell's status isn't the transcript's to
      // decide just because it shares a cwd (and it lets the control surface set
      // a shell's status without the watcher stomping it).
      if (agent && status !== 'working') setStatus(restState())
    }
    window.claudify.subscribeTranscript(transcriptCwd).then((s) => applyStats(s))
    const offTranscript = window.claudify.onTranscript(applyStats)

    const markOutput = () => {
      // Don't claim "working" on the strength of a byte arriving. Wait, then
      // look: if the grid is identical to how it settled, that was a repaint of
      // unchanged content and nothing is happening.
      if (status !== 'working' && workTimer === undefined) {
        workTimer = setTimeout(() => {
          workTimer = undefined
          if (!disposed && screen() !== settled) setStatus('working')
        }, WORK_DELAY_MS)
      }

      clearTimeout(quietTimer)
      quietTimer = setTimeout(settle, QUIET_MS)
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

          // You asked it for something: from here on, going quiet means it has
          // finished YOUR request, and is worth telling you about.
          asked = true

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
        initialCommand: pane.initialCommand,
        // A pane claudify launches `claude` into shouldn't stall on the
        // "trust this folder?" dialog — clear it for the user automatically.
        autoConfirmTrust: !!pane.initialCommand && isAgentCommand(pane.initialCommand)
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

      // Let the control surface (and broadcast input) type into this pane.
      registerInput(pane.id, (data) => p.postMessage(data))

      // ---- the hot path ----
      // Output: PTY -> MessagePort -> xterm. Input: xterm -> MessagePort -> PTY.
      // Neither direction touches React or ipcRenderer, so a keystroke costs one
      // structured-clone hop and nothing else.
      p.onmessage = (e: MessageEvent) => {
        const data = e.data as string | { t: 'exit'; code: number }
        if (typeof data === 'string') {
          // Assess the status only once xterm has actually PARSED the bytes.
          // write() is asynchronous; reading the grid straight after it returns
          // sees the screen as it was a moment ago, so a repaint of unchanged
          // content compares against a stale snapshot and looks like a change.
          term.write(data, markOutput)
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

      /*
       * Shift+Enter should open a new line in an agent's prompt, not submit it.
       * xterm sends a bare CR for Enter regardless of Shift, which every REPL
       * reads as "go". Claude (like most of them) takes ESC+CR as a literal
       * newline, so send that instead and keep it away from the command sniffer
       * — the line isn't finished, so the pane shouldn't be renamed off it.
       */
      term.attachCustomKeyEventHandler((e) => {
        if (e.type !== 'keydown' || e.key !== 'Enter') return true
        if (!e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return true
        // preventDefault is not optional here. Returning false only tells xterm
        // to keep its hands off the keydown — the browser still raises the
        // keypress, and xterm's keypress path would then send a plain CR and
        // submit the line, which is the very thing we're preventing.
        e.preventDefault()
        p.postMessage('\x1b\r')
        return false
      })
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

    // Live font size: Ctrl+= / Ctrl+- retune every open terminal at once.
    const offFont = subscribeFontSize((n) => {
      if (disposed) return
      term.options.fontSize = n
      resize()
    })

    return () => {
      disposed = true
      clearTimeout(quietTimer)
      clearTimeout(workTimer)
      offFont()
      offTranscript()
      window.claudify.unsubscribeTranscript(transcriptCwd)
      unregisterInput(pane.id)
      unregisterScrollback(pane.id)
      unregisterSearch(pane.id)
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
