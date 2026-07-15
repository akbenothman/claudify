import { useEffect, useState } from 'react'
import type { ConvoStatus } from '../../../shared/types'
import { newId, nowIso, useDashboard } from '../useDashboard'

const CYCLE: ConvoStatus[] = ['active', 'waiting', 'done']

/** Relative time, so a row tells you at a glance how stale it is. */
function ago(iso?: string): string {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(ms)) return ''
  const m = Math.floor(ms / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export function TrackerPane() {
  const { data, update } = useDashboard()
  const [draft, setDraft] = useState('')
  const [editRow, setEditRow] = useState<string | null>(null)
  const [path, setPath] = useState('')

  useEffect(() => {
    window.claudify.dashboardPath().then(setPath)
  }, [])

  if (!data) return <div className="board empty">loading…</div>

  const add = () => {
    const title = draft.trim()
    if (!title) return
    setDraft('')
    update((d) => ({
      ...d,
      conversations: [
        ...d.conversations,
        { id: newId(), title, status: 'active', updated: nowIso() }
      ]
    }))
  }

  const cycle = (id: string) =>
    update((d) => ({
      ...d,
      conversations: d.conversations.map((c) =>
        c.id === id
          ? {
              ...c,
              status: CYCLE[(CYCLE.indexOf(c.status) + 1) % CYCLE.length],
              updated: nowIso()
            }
          : c
      )
    }))

  const remove = (id: string) =>
    update((d) => ({ ...d, conversations: d.conversations.filter((c) => c.id !== id) }))

  const editTitle = (id: string, title: string) =>
    update((d) => ({
      ...d,
      conversations: d.conversations.map((c) =>
        c.id === id ? { ...c, title, updated: nowIso() } : c
      )
    }))

  return (
    <div className="board">
      <div className="board-head">
        <strong>conversations</strong>
        <span className="dim">{data.conversations.filter((c) => c.status === 'active').length} active</span>
      </div>

      <div className="board-list">
        {data.conversations.length === 0 && (
          <div className="board-empty">
            No threads tracked. Ask the Claude on the left to add one — it can edit this list.
          </div>
        )}
        {data.conversations.map((c) => (
          <div key={c.id} className={`row row-${c.status}`}>
            <button
              className={`chip chip-${c.status}`}
              onClick={() => cycle(c.id)}
              title={`${c.status} — click to advance`}
            >
              {c.status}
            </button>
            {editRow === c.id ? (
              <input
                className="row-edit"
                autoFocus
                defaultValue={c.title}
                onClick={(e) => e.stopPropagation()}
                onBlur={(e) => {
                  const v = e.target.value.trim()
                  if (v) editTitle(c.id, v)
                  setEditRow(null)
                }}
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (e.key === 'Enter') {
                    const v = (e.target as HTMLInputElement).value.trim()
                    if (v) editTitle(c.id, v)
                    setEditRow(null)
                  }
                  if (e.key === 'Escape') setEditRow(null)
                }}
              />
            ) : (
              <span
                className="row-text"
                title="Double-click to edit"
                onDoubleClick={() => setEditRow(c.id)}
              >
                {c.title}
                {c.summary && <span className="row-sub">{c.summary}</span>}
              </span>
            )}
            <span className="row-ago dim">{ago(c.updated)}</span>
            <button className="pane-x row-del" onClick={() => remove(c.id)} title="Delete">
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="board-add">
        <input
          value={draft}
          placeholder="track a thread…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter') add()
          }}
        />
        <button onClick={add}>add</button>
      </div>

      {/* Tell the user (and any agent reading over their shoulder) where the file is. */}
      <div className="board-foot dim" title={path}>
        Claude can edit: <code>{path}</code>
      </div>
    </div>
  )
}
