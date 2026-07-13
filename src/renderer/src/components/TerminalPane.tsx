import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { takePort } from '../ptyPorts'
import { useStore, type Pane } from '../store'
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
  pane: Pane
  focused: boolean
}

export function TerminalPane({ wsId, pane, focused }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)

  // Read these from the store imperatively; putting them in the effect's dep
  // array would tear down and respawn the PTY on every unrelated re-render.
  const updatePane = useStore((s) => s.updatePane)
  const setActivePane = useStore((s) => s.setActivePane)

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
    term.open(host)

    // WebGL is the reason large outputs stay smooth. It can fail on some GPUs /
    // in software rendering, in which case xterm silently falls back to canvas.
    try {
      const webgl = new WebglAddon()
      webgl.onContextLoss(() => webgl.dispose())
      term.loadAddon(webgl)
    } catch {
      /* fall back to the DOM/canvas renderer */
    }

    fit.fit()

    // cmux-style attention signals: an agent that wants you raises OSC 9 or
    // OSC 777, and most CLIs ring the bell when they need input.
    const raiseAttention = () => {
      if (!disposed) updatePane(wsId, pane.id, { attention: true })
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
        } else if (data?.t === 'exit') {
          term.write(`\r\n\x1b[90m[process exited with code ${data.code}]\x1b[0m\r\n`)
          if (!disposed) updatePane(wsId, pane.id, { exited: true })
        }
      }
      p.start()
      term.onData((d) => p.postMessage(d))
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
    <div
      className="term-host"
      ref={hostRef}
      onMouseDown={() => setActivePane(wsId, pane.id)}
    />
  )
}
