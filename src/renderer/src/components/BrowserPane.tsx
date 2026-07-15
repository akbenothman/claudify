import { useEffect, useRef, useState } from 'react'

/**
 * A browser pane. The actual page is a native WebContentsView owned by the main
 * process (see main/browser.ts) — this component is the chrome around it: a URL
 * bar, and an empty host div whose on-screen rectangle we report to main so it
 * can position the native view over it. When the pane goes off screen we detach
 * the view (it keeps running, just hidden), so Claude's session survives.
 */
export function BrowserPane({ paneId, visible }: { paneId: string; visible: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [url, setUrl] = useState('')
  const [current, setCurrent] = useState('about:blank')
  const [mcpPath, setMcpPath] = useState('')

  useEffect(() => {
    window.claudify.mcpConfigPath().then(setMcpPath)
  }, [])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    // Hidden panes (other tab/workspace) have a zero-size rect; don't place the
    // view there — detach until we're back on screen.
    if (!visible) {
      window.claudify.browserDetach(paneId)
      return
    }

    const rect = () => {
      const r = host.getBoundingClientRect()
      return {
        x: Math.round(r.x),
        y: Math.round(r.y),
        width: Math.round(r.width),
        height: Math.round(r.height)
      }
    }
    window.claudify.browserAttach(paneId, rect())
    window.claudify.browserInfo().then((i) => {
      setCurrent(i.url)
      if (!url && i.url !== 'about:blank') setUrl(i.url)
    })

    const send = () => window.claudify.browserBounds(paneId, rect())
    const ro = new ResizeObserver(send)
    ro.observe(host)
    window.addEventListener('resize', send)

    return () => {
      ro.disconnect()
      window.removeEventListener('resize', send)
      window.claudify.browserDetach(paneId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, paneId])

  const go = async () => {
    const u = url.trim()
    if (!u) return
    const i = await window.claudify.browserNavigate(u)
    setUrl(i.url)
    setCurrent(i.url)
  }

  const back = async () => {
    const i = await window.claudify.browserBack()
    setUrl(i.url)
    setCurrent(i.url)
  }

  const reload = async () => {
    const i = await window.claudify.browserReload()
    setUrl(i.url)
    setCurrent(i.url)
  }

  return (
    <div className="browser">
      <div className="browser-bar">
        <button onClick={back} title="Back">
          ←
        </button>
        <button onClick={reload} title="Reload">
          ⟳
        </button>
        <input
          value={url}
          placeholder="url…"
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter') go()
          }}
        />
        <button onClick={go}>go</button>
      </div>
      {/* The native browser view is painted over this box by the main process. */}
      <div className="browser-host" ref={hostRef} />
      <div className="browser-foot dim" title={mcpPath}>
        {current === 'about:blank' ? 'Claude drives this' : current} · MCP:{' '}
        <code>claudify-browser</code>
      </div>
    </div>
  )
}
