import { useState } from 'react'
import type { TodoStatus } from '../../../shared/types'
import { dropIndex, reorder, TOPIC_MIME } from '../boardDnd'
import { newId, nowIso, useDashboard } from '../useDashboard'

const CYCLE: TodoStatus[] = ['todo', 'doing', 'blocked', 'done']

const GLYPH: Record<TodoStatus, string> = {
  todo: '○',
  doing: '◐',
  blocked: '⊘',
  done: '●'
}

export function TodoPane() {
  const { data, update } = useDashboard()
  const [draft, setDraft] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  /** Todo row whose text is being edited inline (double-click to enter). */
  const [editRow, setEditRow] = useState<string | null>(null)
  /** Index the dragged topic would land at, for the insertion caret. */
  const [dropAt, setDropAt] = useState<number | null>(null)

  if (!data) return <div className="board empty">loading…</div>

  const topics = data.topics
  // The selected topic can vanish under us — an agent editing the file may
  // delete it — so fall back rather than render an empty pane.
  const topic = topics.find((t) => t.id === activeId) ?? topics[0]

  const patchTopic = (id: string, fn: (todos: typeof topic.todos) => typeof topic.todos) =>
    update((d) => ({
      ...d,
      topics: d.topics.map((t) => (t.id === id ? { ...t, todos: fn(t.todos) } : t))
    }))

  const add = () => {
    const text = draft.trim()
    if (!text || !topic) return
    setDraft('')
    patchTopic(topic.id, (todos) => [
      ...todos,
      { id: newId(), text, status: 'todo', updated: nowIso() }
    ])
  }

  const cycle = (id: string) =>
    topic &&
    patchTopic(topic.id, (todos) =>
      todos.map((t) =>
        t.id === id
          ? { ...t, status: CYCLE[(CYCLE.indexOf(t.status) + 1) % CYCLE.length], updated: nowIso() }
          : t
      )
    )

  const remove = (id: string) =>
    topic && patchTopic(topic.id, (todos) => todos.filter((t) => t.id !== id))

  const editText = (id: string, text: string) =>
    topic &&
    patchTopic(topic.id, (todos) =>
      todos.map((t) => (t.id === id ? { ...t, text, updated: nowIso() } : t))
    )

  const clearDone = () =>
    topic && patchTopic(topic.id, (todos) => todos.filter((t) => t.status !== 'done'))

  const addTopic = () => {
    const t = { id: newId(), name: 'new topic', todos: [] }
    update((d) => ({ ...d, topics: [...d.topics, t] }))
    setActiveId(t.id)
    setEditing(t.id)
  }

  const renameTopic = (id: string, name: string) =>
    update((d) => ({ ...d, topics: d.topics.map((t) => (t.id === id ? { ...t, name } : t)) }))

  const removeTopic = (id: string) => {
    // Never leave the pane with no tabs at all.
    if (topics.length <= 1) return
    update((d) => ({ ...d, topics: d.topics.filter((t) => t.id !== id) }))
    if (activeId === id) setActiveId(null)
  }

  const done = topic ? topic.todos.filter((t) => t.status === 'done').length : 0
  const total = topic ? topic.todos.length : 0
  const pct = total ? Math.round((done / total) * 100) : 0

  return (
    <div className="board todo">
      <div className="board-tabs">
        {topics.map((t, i) => (
          <div
            key={t.id}
            className={`board-tab${t.id === topic?.id ? ' active' : ''}${
              dropAt === i ? ' drop-before' : ''
            }`}
            draggable={editing !== t.id}
            onDragStart={(e) => {
              e.dataTransfer.setData(TOPIC_MIME, String(i))
              e.dataTransfer.effectAllowed = 'move'
            }}
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes(TOPIC_MIME)) return
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              setDropAt(dropIndex(e.currentTarget.getBoundingClientRect(), e.clientX, i))
            }}
            onDragLeave={() => setDropAt(null)}
            onDrop={(e) => {
              const raw = e.dataTransfer.getData(TOPIC_MIME)
              setDropAt(null)
              if (!raw) return
              e.preventDefault()
              const from = parseInt(raw, 10)
              const to = dropIndex(e.currentTarget.getBoundingClientRect(), e.clientX, i)
              // Dropping to the right of yourself: the list closes up behind you,
              // so the target index shifts down by one.
              update((d) => ({ ...d, topics: reorder(d.topics, from, to > from ? to - 1 : to) }))
            }}
            onClick={() => setActiveId(t.id)}
            onDoubleClick={() => setEditing(t.id)}
          >
            {editing === t.id ? (
              <input
                className="rename"
                autoFocus
                defaultValue={t.name}
                onClick={(e) => e.stopPropagation()}
                onBlur={(e) => {
                  const v = e.target.value.trim()
                  if (v) renameTopic(t.id, v)
                  setEditing(null)
                }}
                onKeyDown={(e) => {
                  e.stopPropagation()
                  // Commit on Enter outright rather than leaning on blur: the
                  // input isn't always focused (nothing to blur), and a rename
                  // that silently doesn't happen is worse than one that does.
                  if (e.key === 'Enter') {
                    const v = (e.target as HTMLInputElement).value.trim()
                    if (v) renameTopic(t.id, v)
                    setEditing(null)
                  }
                  if (e.key === 'Escape') setEditing(null)
                }}
              />
            ) : (
              <>
                <span className="board-tab-name">{t.name}</span>
                <span className="board-tab-count">
                  {t.todos.filter((x) => x.status !== 'done').length}
                </span>
                {topics.length > 1 && (
                  <button
                    className="pane-x"
                    title="Delete topic"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeTopic(t.id)
                    }}
                  >
                    ×
                  </button>
                )}
              </>
            )}
          </div>
        ))}
        <button className="board-tab-new" onClick={addTopic} title="New topic">
          +
        </button>
      </div>

      <div className="board-meter">
        <div className="board-meter-fill" style={{ width: `${pct}%` }} />
      </div>

      <div className="board-head">
        <strong>{topic?.name ?? 'todo'}</strong>
        <span className="dim">
          {total - done} open · {done}/{total} done
        </span>
        <span className="spacer" />
        {done > 0 && (
          <button className="board-clear" onClick={clearDone} title="Remove completed items">
            clear done
          </button>
        )}
      </div>

      <div className="board-list">
        {total === 0 && <div className="board-empty">Nothing here yet. Add one below.</div>}
        {topic?.todos.map((t) => (
          <div key={t.id} className={`row row-${t.status}`}>
            <button
              className={`chip chip-${t.status}`}
              onClick={() => cycle(t.id)}
              title={`${t.status} — click to advance`}
            >
              {GLYPH[t.status]} {t.status}
            </button>
            {editRow === t.id ? (
              <input
                className="row-edit"
                autoFocus
                defaultValue={t.text}
                onClick={(e) => e.stopPropagation()}
                onBlur={(e) => {
                  const v = e.target.value.trim()
                  if (v) editText(t.id, v)
                  setEditRow(null)
                }}
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (e.key === 'Enter') {
                    const v = (e.target as HTMLInputElement).value.trim()
                    if (v) editText(t.id, v)
                    setEditRow(null)
                  }
                  if (e.key === 'Escape') setEditRow(null)
                }}
              />
            ) : (
              <span
                className="row-text"
                title="Double-click to edit"
                onDoubleClick={() => setEditRow(t.id)}
              >
                {t.text}
              </span>
            )}
            <button className="pane-x row-del" onClick={() => remove(t.id)} title="Delete">
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="board-add">
        <input
          value={draft}
          placeholder={topic ? `add to ${topic.name}…` : 'new todo…'}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter') add()
          }}
        />
        <button onClick={add}>add</button>
      </div>
    </div>
  )
}
