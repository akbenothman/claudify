import { useEffect, useState } from 'react'
import {
  activeWorkspace,
  panesNeedingYou,
  setMcpConfig,
  tabStatus,
  tabUnseen,
  unseenCount,
  useStore
} from './store'
import { Stage } from './components/Stage'
import { SplitDialog } from './components/SplitDialog'
import { SettingsDialog } from './components/SettingsDialog'
import { Sidebar } from './components/Sidebar'
import { TabBar } from './components/TabBar'
import { StatusDot } from './components/StatusDot'
import { CommandPalette } from './components/CommandPalette'
import { TermSearch } from './components/TermSearch'
import { ContextMenu, type MenuState } from './components/ContextMenu'
import { startPersistence } from './persistence'
import { handleControlRequest } from './control'
import { bumpFontSize, initFontSize, resetFontSize } from './termPrefs'

export function App() {
  const workspaces = useStore((s) => s.workspaces)
  const activeId = useStore((s) => s.activeWorkspaceId)
  const ws = useStore(activeWorkspace)
  const newWorkspace = useStore((s) => s.newWorkspace)
  const setDefaultCwd = useStore((s) => s.setDefaultCwd)
  const hydrate = useStore((s) => s.hydrate)

  const [showSplit, setShowSplit] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showPalette, setShowPalette] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [booted, setBooted] = useState(false)

  // Boot: restore the saved session, or open a fresh workspace in $HOME.
  useEffect(() => {
    let cancelled = false
    Promise.all([
      window.claudify.home(),
      window.claudify.loadState(),
      window.claudify.mcpConfigPath(),
      window.claudify.getSettings()
    ]).then(([home, state, mcpPath, settings]) => {
      if (cancelled) return
      // Learn the browser MCP config path before any pane launches Claude, so
      // its command carries the --mcp-config flag.
      setMcpConfig(mcpPath)
      // Seed the live terminal font size before any pane mounts, so the first
      // terminal opens at the size you last chose.
      initFontSize(settings.fontSize)
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

  // The control surface: an agent editing control.json drives the terminal.
  useEffect(() => window.claudify.onControlRequest(handleControlRequest), [])

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

      // Font size: Ctrl+= / Ctrl+- / Ctrl+0, matching browser-zoom muscle memory.
      // These resize every open terminal live and persist the choice.
      if (e.key === '=' || e.key === '+') {
        handled()
        bumpFontSize(1)
        return
      }
      if (e.key === '-' || e.key === '_') {
        handled()
        bumpFontSize(-1)
        return
      }
      if (e.key === '0') {
        handled()
        resetFontSize()
        return
      }

      // Ctrl+Tab / Ctrl+Shift+Tab — cycle tabs within the workspace.
      if (key === 'tab') {
        handled()
        if (cur && cur.tabs.length > 1) {
          const i = cur.tabs.findIndex((t) => t.id === cur.activeTabId)
          const n = cur.tabs.length
          const j = ((e.shiftKey ? i - 1 : i + 1) + n) % n
          s.setActiveTab(cur.id, cur.tabs[j].id)
        }
        return
      }

      if (!e.shiftKey) return

      switch (key) {
        case 'p': // command palette
          handled()
          setShowPalette((v) => !v)
          break
        case 'f': // find in the focused terminal
          handled()
          setShowSearch(true)
          break
        case 'j': {
          // Jump to the next agent that needs you — the whole point of the
          // status model. Cycles blocked → finished → unseen, most urgent first.
          handled()
          const list = panesNeedingYou(s)
          if (list.length === 0) break
          const curPane = tab?.activePaneId
          const at = list.findIndex((r) => r.paneId === curPane)
          const next = list[(at + 1) % list.length]
          s.setActiveWorkspace(next.wsId)
          s.setActiveTab(next.wsId, next.tabId)
          s.setActivePane(next.wsId, next.tabId, next.paneId)
          break
        }
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
        case 'b': // open a browser pane (Claude drives it via MCP)
          handled()
          if (cur) s.newBrowserTab(cur.id)
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
            <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> palette
            <i />
            <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>J</kbd> next agent
            <i />
            <kbd>D</kbd>/<kbd>E</kbd> split
            <i />
            <kbd>Enter</kbd> zoom
            <i />
            <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd> find
          </span>
        </div>
      </div>

      {showSplit && <SplitDialog onClose={() => setShowSplit(false)} />}
      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
      {showPalette && (
        <CommandPalette
          onClose={() => setShowPalette(false)}
          onSplit={() => setShowSplit(true)}
          onSettings={() => setShowSettings(true)}
        />
      )}
      {showSearch && <TermSearch onClose={() => setShowSearch(false)} />}
      {menu && <ContextMenu menu={menu} onClose={() => setMenu(null)} />}
    </div>
  )
}
