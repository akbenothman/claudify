import { useEffect, useRef, useState } from 'react'
import { useStore, workspaceNeedsAttention, workspaceStatus, workspaceUnseen } from '../store'
import { StatusDot } from './StatusDot'
import { TAB_MIME, WS_MIME, type TabDrag, type WorkspaceDrag } from '../dnd'
import type { MenuState } from './ContextMenu'

/** Inline rename field. Commits on Enter or blur, cancels on Escape. */
function RenameField({
  initial,
  onCommit,
  onCancel
}: {
  initial: string
  onCommit: (v: string) => void
  onCancel: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [v, setV] = useState(initial)

  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])

  return (
    <input
      ref={ref}
      className="rename"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onMouseDown={(e) => e.stopPropagation()}
      onBlur={() => (v.trim() ? onCommit(v.trim()) : onCancel())}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter' && v.trim()) onCommit(v.trim())
        if (e.key === 'Escape') onCancel()
      }}
    />
  )
}

export function Sidebar({
  onSplit,
  onSettings,
  openMenu
}: {
  onSplit: () => void
  onSettings: () => void
  openMenu: (m: MenuState) => void
}) {
  const workspaces = useStore((s) => s.workspaces)
  const activeId = useStore((s) => s.activeWorkspaceId)
  const setActiveWorkspace = useStore((s) => s.setActiveWorkspace)
  const closeWorkspace = useStore((s) => s.closeWorkspace)
  const renameWorkspace = useStore((s) => s.renameWorkspace)
  const newWorkspace = useStore((s) => s.newWorkspace)
  const moveTab = useStore((s) => s.moveTab)
  const moveWorkspace = useStore((s) => s.moveWorkspace)

  const [editing, setEditing] = useState<string | null>(null)
  /** Workspace row currently being hovered by a dragged tab. */
  const [dropOn, setDropOn] = useState<string | null>(null)

  return (
    <div className="sidebar">
      <div className="sidebar-head">
        <span className="brand">claudify</span>
        <button className="gear" onClick={onSettings} title="Settings">
          ⚙
        </button>
      </div>

      <button className="split-btn" onClick={onSplit} title="Split into worktrees (Ctrl+Shift+S)">
        <span className="split-glyph">⑂</span> worktree split
      </button>

      <div className="sidebar-label">workspaces</div>

      <div className="ws-list">
        {workspaces.map((w, i) => (
          <div
            key={w.id}
            data-ws-id={w.id}
            draggable={editing !== w.id}
            onDragStart={(e) => {
              const payload: WorkspaceDrag = { index: i }
              e.dataTransfer.setData(WS_MIME, JSON.stringify(payload))
              e.dataTransfer.effectAllowed = 'move'
            }}
            onDragOver={(e) => {
              const types = e.dataTransfer.types
              if (!types.includes(TAB_MIME) && !types.includes(WS_MIME)) return
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              if (types.includes(TAB_MIME)) setDropOn(w.id)
            }}
            onDragLeave={() => setDropOn(null)}
            onDrop={(e) => {
              setDropOn(null)
              const tabRaw = e.dataTransfer.getData(TAB_MIME)
              if (tabRaw) {
                e.preventDefault()
                const drag = JSON.parse(tabRaw) as TabDrag
                // Dropped on a workspace row: append to the end of its tabs.
                moveTab(drag.wsId, drag.tabId, w.id, w.tabs.length)
                return
              }
              const wsRaw = e.dataTransfer.getData(WS_MIME)
              if (wsRaw) {
                e.preventDefault()
                const drag = JSON.parse(wsRaw) as WorkspaceDrag
                moveWorkspace(drag.index, i)
              }
            }}
            className={`ws${w.id === activeId ? ' active' : ''}${
              workspaceNeedsAttention(w) ? ' attention' : ''
            }${workspaceUnseen(w) ? ' unseen' : ''}${dropOn === w.id ? ' drop-target' : ''}`}
            onClick={() => setActiveWorkspace(w.id)}
            onDoubleClick={() => setEditing(w.id)}
            onContextMenu={(e) => {
              e.preventDefault()
              setActiveWorkspace(w.id)
              openMenu({
                x: e.clientX,
                y: e.clientY,
                items: [
                  { label: 'Rename', onClick: () => setEditing(w.id) },
                  { label: 'New tab here', onClick: () => useStore.getState().newTab(w.id) },
                  // The dashboard is permanent — no delete option at all, rather
                  // than a disabled one that just teases.
                  ...(w.permanent
                    ? []
                    : [
                        {
                          label: 'Delete workspace',
                          danger: true,
                          separated: true,
                          onClick: () => closeWorkspace(w.id)
                        }
                      ])
                ]
              })
            }}
            title={w.cwd}
          >
            <span className="ws-idx">{i < 9 ? i + 1 : '·'}</span>
            {editing === w.id ? (
              <RenameField
                initial={w.name}
                onCommit={(v) => {
                  renameWorkspace(w.id, v)
                  setEditing(null)
                }}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <>
                <span className="ws-name">
                  {w.permanent && <span className="ws-pin">★</span>}
                  {w.name}
                </span>
                <StatusDot status={workspaceStatus(w)} unseen={workspaceUnseen(w)} />
                <span className="ws-count">{w.tabs.length}</span>
              </>
            )}
          </div>
        ))}

        {/* Sits directly under the last workspace, not pinned to the bottom. */}
        <button
          className="ws-new"
          onClick={() => newWorkspace()}
          title="New workspace (Ctrl+Shift+N)"
        >
          + new workspace
        </button>
      </div>

      <div className="sidebar-foot dim">right-click a workspace to rename or delete</div>
    </div>
  )
}
