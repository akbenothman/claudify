import { useEffect, useState } from 'react'
import { activeWorkspace, useStore } from './store'
import { SplitTree } from './components/SplitTree'
import { SplitDialog } from './components/SplitDialog'

export function App() {
  const workspaces = useStore((s) => s.workspaces)
  const activeId = useStore((s) => s.activeWorkspaceId)
  const ws = useStore(activeWorkspace)

  const newWorkspace = useStore((s) => s.newWorkspace)
  const setActiveWorkspace = useStore((s) => s.setActiveWorkspace)
  const closeWorkspace = useStore((s) => s.closeWorkspace)
  const setDefaultCwd = useStore((s) => s.setDefaultCwd)

  const [showSplit, setShowSplit] = useState(false)

  // Boot: first workspace opens in the user's home directory.
  useEffect(() => {
    let cancelled = false
    window.claudify.home().then((home) => {
      if (cancelled) return
      setDefaultCwd(home)
      if (useStore.getState().workspaces.length === 0) newWorkspace('workspace 1', home)
    })
    return () => {
      cancelled = true
    }
  }, [newWorkspace, setDefaultCwd])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState()
      const cur = s.workspaces.find((w) => w.id === s.activeWorkspaceId)
      if (!e.ctrlKey || !e.shiftKey) return

      const key = e.key.toLowerCase()
      const handled = () => {
        e.preventDefault()
        e.stopPropagation()
      }

      switch (key) {
        case 't':
          handled()
          s.newWorkspace()
          break
        case 'd': // split right
          handled()
          if (cur?.activePaneId) s.splitPane(cur.id, cur.activePaneId, 'row')
          break
        case 'e': // split down
          handled()
          if (cur?.activePaneId) s.splitPane(cur.id, cur.activePaneId, 'col')
          break
        case 'w':
          handled()
          if (cur?.activePaneId) s.closePane(cur.id, cur.activePaneId)
          break
        case 's':
          handled()
          setShowSplit(true)
          break
        case 'enter':
          handled()
          if (cur) s.toggleZoom(cur.id)
          break
        default: {
          const n = parseInt(e.key, 10)
          if (n >= 1 && n <= 9 && s.workspaces[n - 1]) {
            handled()
            s.setActiveWorkspace(s.workspaces[n - 1].id)
          }
        }
      }
    }
    // Capture phase: xterm swallows keydown on the focused terminal otherwise.
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  return (
    <div className="app">
      <div className="titlebar">
        <div className="brand">claudify</div>
        <div className="tabs">
          {workspaces.map((w) => (
            <div
              key={w.id}
              className={`tab${w.id === activeId ? ' active' : ''}${
                Object.values(w.panes).some((p) => p.attention) ? ' attention' : ''
              }`}
              onClick={() => setActiveWorkspace(w.id)}
            >
              <span>{w.name}</span>
              <button
                className="tab-x"
                onClick={(e) => {
                  e.stopPropagation()
                  closeWorkspace(w.id)
                }}
              >
                ×
              </button>
            </div>
          ))}
          <button className="tab-new" onClick={() => newWorkspace()} title="New workspace (Ctrl+Shift+T)">
            +
          </button>
        </div>
        <div className="titlebar-right">
          <button className="split-btn" onClick={() => setShowSplit(true)} title="Ctrl+Shift+S">
            ⑂ split
          </button>
        </div>
      </div>

      <div className="stage">
        {/* Every workspace stays mounted. Unmounting one would kill the PTYs —
            and the agents — running inside it. */}
        {workspaces.map((w) => (
          <div key={w.id} className={`workspace${w.id === activeId ? '' : ' inactive'}`}>
            <SplitTree ws={w} />
          </div>
        ))}
        {workspaces.length === 0 && (
          <div className="empty">No workspaces. Ctrl+Shift+T to open one.</div>
        )}
      </div>

      <div className="statusbar">
        <span>{ws?.name ?? '—'}</span>
        <span className="dim">
          {ws ? `${Object.keys(ws.panes).length} pane(s)` : ''}
          {ws?.zoomedPaneId ? ' · zoomed' : ''}
        </span>
        <span className="spacer" />
        <span className="dim">
          Ctrl+Shift: T new · D split right · E split down · W close · Enter zoom · S worktree split
        </span>
      </div>

      {showSplit && <SplitDialog onClose={() => setShowSplit(false)} />}
    </div>
  )
}
