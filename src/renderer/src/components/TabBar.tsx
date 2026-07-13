import { useEffect, useRef, useState } from 'react'
import { tabNeedsAttention, tabStatus, tabTitle, tabUnseen, useStore, type Workspace } from '../store'
import { StatusDot } from './StatusDot'
import { TAB_MIME, type TabDrag } from '../dnd'
import type { MenuState } from './ContextMenu'

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
      className="rename rename-tab"
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

export function TabBar({ ws, openMenu }: { ws: Workspace; openMenu: (m: MenuState) => void }) {
  const setActiveTab = useStore((s) => s.setActiveTab)
  const closeTab = useStore((s) => s.closeTab)
  const renameTab = useStore((s) => s.renameTab)
  const newTab = useStore((s) => s.newTab)
  const moveTab = useStore((s) => s.moveTab)

  const [editing, setEditing] = useState<string | null>(null)
  /** Index the dragged tab would land at, for the insertion caret. */
  const [dropAt, setDropAt] = useState<number | null>(null)
  const barRef = useRef<HTMLDivElement>(null)

  /** Which gap the pointer is nearest, by comparing against each tab's midpoint. */
  const indexFor = (clientX: number): number => {
    const tabs = [...(barRef.current?.querySelectorAll('.tab') ?? [])] as HTMLElement[]
    let i = 0
    for (const el of tabs) {
      const box = el.getBoundingClientRect()
      if (clientX > box.left + box.width / 2) i++
    }
    return i
  }

  const onDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes(TAB_MIME)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropAt(indexFor(e.clientX))
  }

  const onDrop = (e: React.DragEvent) => {
    const raw = e.dataTransfer.getData(TAB_MIME)
    setDropAt(null)
    if (!raw) return
    e.preventDefault()
    const drag = JSON.parse(raw) as TabDrag
    moveTab(drag.wsId, drag.tabId, ws.id, indexFor(e.clientX))
  }

  return (
    <div
      className="tabbar"
      ref={barRef}
      onDragOver={onDragOver}
      onDragLeave={() => setDropAt(null)}
      onDrop={onDrop}
    >
      {ws.tabs.map((t, i) => {
        const panes = Object.keys(t.panes).length
        const unseen = tabUnseen(t)
        return (
          <div key={t.id} className="tab-slot">
            {dropAt === i && <div className="tab-caret" />}
            <div
              data-tab-id={t.id}
              data-ws-id={ws.id}
              draggable={editing !== t.id}
              onDragStart={(e) => {
                const payload: TabDrag = { wsId: ws.id, tabId: t.id }
                e.dataTransfer.setData(TAB_MIME, JSON.stringify(payload))
                e.dataTransfer.effectAllowed = 'move'
              }}
              className={`tab${t.id === ws.activeTabId ? ' active' : ''}${
                tabNeedsAttention(t) ? ' attention' : ''
              }${unseen ? ' unseen' : ''}`}
              onClick={() => setActiveTab(ws.id, t.id)}
              onDoubleClick={() => setEditing(t.id)}
              onContextMenu={(e) => {
                e.preventDefault()
                setActiveTab(ws.id, t.id)
                openMenu({
                  x: e.clientX,
                  y: e.clientY,
                  items: [
                    { label: 'Rename', onClick: () => setEditing(t.id) },
                    {
                      label: 'Close tab',
                      danger: true,
                      separated: true,
                      onClick: () => closeTab(ws.id, t.id)
                    }
                  ]
                })
              }}
            >
              {editing === t.id ? (
                <RenameField
                  initial={tabTitle(t)}
                  onCommit={(v) => {
                    renameTab(ws.id, t.id, v)
                    setEditing(null)
                  }}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <>
                  <StatusDot status={tabStatus(t)} unseen={unseen} />
                  <span className="tab-name">{tabTitle(t)}</span>
                  {panes > 1 && <span className="tab-panes">{panes}</span>}
                  <button
                    className="tab-x"
                    onClick={(e) => {
                      e.stopPropagation()
                      closeTab(ws.id, t.id)
                    }}
                  >
                    ×
                  </button>
                </>
              )}
            </div>
          </div>
        )
      })}

      {dropAt === ws.tabs.length && <div className="tab-caret" />}

      <button className="tab-new" onClick={() => newTab(ws.id)} title="New tab (Ctrl+T)">
        +
      </button>
    </div>
  )
}
