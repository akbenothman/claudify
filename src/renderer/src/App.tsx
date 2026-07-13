import { useEffect, useState } from 'react'
import { activeWorkspace, tabStatus, tabUnseen, unseenCount, useStore } from './store'
import { Stage } from './components/Stage'
import { SplitDialog } from './components/SplitDialog'
import { SettingsDialog } from './components/SettingsDialog'
import { Sidebar } from './components/Sidebar'
import { TabBar } from './components/TabBar'
import { StatusDot } from './components/StatusDot'
import { ContextMenu, type MenuState } from './components/ContextMenu'
import { startPersistence } from './persistence'

export function App() {
  const workspaces = useStore((s) => s.workspaces)
  const activeId = useStore((s) => s.activeWorkspaceId)
  const ws = useStore(activeWorkspace)
  const newWorkspace = useStore((s) => s.newWorkspace)
  const setDefaultCwd = useStore((s) => s.setDefaultCwd)
  const hydrate = useStore((s) => s.hydrate)

  const [showSplit, setShowSplit] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [booted, setBooted] = useState(false)

  // Boot: restore the saved session, or open a fresh workspace in $HOME.
  useEffect(() => {
    let cancelled = false
    Promise.all([window.claudify.home(), window.claudify.loadState()]).then(([home, state]) => {
      if (cancelled) return
      setDefaultCwd(home)

      if (state.session.workspaces.length > 0) {
        hydrate(state.session)
      }
      // The dashboard is permanent: recreate it if this is a first run, or if a
      // session saved before it existed comes back without one.
      useStore.getState().ensureDashboard(home)

      // Only start mirroring to disk after the restore has landed, or the empty
      // pre-hydrate store would immediately overwrite the saved session.
      startPersistence()
      setBooted(true)
    })
    return () => {
      cancelled = true
    }
  }, [hydrate, newWorkspace, setDefaultCwd])

  /*
   * Anything on screen counts as checked on. This fires when you switch tab or
   * workspace, and when you come back to the window — so a pane that finished
   * while you were in another app stays flagged until you actually return to it.
   */
  const activeTabId = ws?.activeTabId ?? null
  const acknowledgeTab = useStore((s) => s.acknowledgeTab)

  useEffect(() => {
    if (!activeId || !activeTabId) return
    const ack = () => acknowledgeTab(activeId, activeTabId)
    if (document.hasFocus()) ack()
    window.addEventListener('focus', ack)
    return () => window.removeEventListener('focus', ack)
  }, [acknowledgeTab, activeId, activeTabId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey) return
      const s = useStore.getState()
      const cur = s.workspaces.find((w) => w.id === s.activeWorkspaceId)
      const tab = cur?.tabs.find((t) => t.id === cur.activeTabId)
      const key = e.key.toLowerCase()

      const handled = () => {
        e.preventDefault()
        e.stopPropagation()
      }

      // Ctrl+T (no Shift) — new tab.
      if (key === 't' && !e.shiftKey) {
        handled()
        if (cur) s.newTab(cur.id)
        return
      }

      if (!e.shiftKey) return

      switch (key) {
        case 't': // Ctrl+Shift+T also makes a tab, so muscle memory from before still works.
          handled()
          if (cur) s.newTab(cur.id)
          break
        case 'n':
          handled()
          s.newWorkspace()
          break
        case 'd': // split right
          handled()
          if (cur && tab?.activePaneId) s.splitPane(cur.id, tab.id, tab.activePaneId, 'row')
          break
        case 'e': // split down
          handled()
          if (cur && tab?.activePaneId) s.splitPane(cur.id, tab.id, tab.activePaneId, 'col')
          break
        case 'w':
          handled()
          if (cur && tab?.activePaneId) s.closePane(cur.id, tab.id, tab.activePaneId)
          break
        case 's':
          handled()
          setShowSplit(true)
          break
        case 'enter':
          handled()
          if (cur && tab) s.toggleZoom(cur.id, tab.id)
          break
        default: {
          // Ctrl+Shift+1..9 jumps between workspaces.
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

  const activeTab = ws?.tabs.find((t) => t.id === ws.activeTabId)
  const unchecked = useStore(unseenCount)

  return (
    <div className="app">
      <Sidebar
        onSplit={() => setShowSplit(true)}
        onSettings={() => setShowSettings(true)}
        openMenu={setMenu}
      />

      <div className="content">
        <div className="topbar">
          {ws ? <TabBar ws={ws} openMenu={setMenu} /> : <div className="tabbar" />}
          <div className="drag-space" />
        </div>

        <Stage />

        {booted && workspaces.length === 0 && (
          <div className="empty">
            <div className="empty-card">
              <div className="empty-title">No workspaces</div>
              <button className="primary" onClick={() => newWorkspace()}>
                New workspace
              </button>
            </div>
          </div>
        )}

        <div className="statusbar">
          <span className="status-ws">{ws?.name ?? '—'}</span>
          {activeTab && (
            <StatusDot status={tabStatus(activeTab)} unseen={tabUnseen(activeTab)} label />
          )}
          {unchecked > 0 && (
            <span className="unseen-badge" title="Panes that finished while you were elsewhere">
              {unchecked} unchecked
            </span>
          )}
          {activeTab && (
            <span className="dim">
              {Object.keys(activeTab.panes).length} pane
              {Object.keys(activeTab.panes).length === 1 ? '' : 's'}
              {activeTab.zoomedPaneId ? ' · zoomed' : ''}
            </span>
          )}
          <span className="spacer" />
          <span className="keys">
            <kbd>Ctrl</kbd>+<kbd>T</kbd> tab
            <i />
            <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>N</kbd> workspace
            <i />
            <kbd>D</kbd>/<kbd>E</kbd> split
            <i />
            <kbd>Enter</kbd> zoom
            <i />
            <kbd>S</kbd> worktree split
          </span>
        </div>
      </div>

      {showSplit && <SplitDialog onClose={() => setShowSplit(false)} />}
      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
      {menu && <ContextMenu menu={menu} onClose={() => setMenu(null)} />}
    </div>
  )
}
