import { useState } from 'react'
import type { TodoStatus } from '../../../shared/types'
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

  if (!data) return <div className="board empty">loading…</div>

  const add = () => {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    update((d) => ({
      ...d,
      todos: [...d.todos, { id: newId(), text, status: 'todo', updated: nowIso() }]
    }))
  }

  const cycle = (id: string) =>
    update((d) => ({
      ...d,
      todos: d.todos.map((t) =>
        t.id === id
          ? {
              ...t,
              status: CYCLE[(CYCLE.indexOf(t.status) + 1) % CYCLE.length],
              updated: nowIso()
            }
          : t
      )
    }))

  const remove = (id: string) =>
    update((d) => ({ ...d, todos: d.todos.filter((t) => t.id !== id) }))

  const open = data.todos.filter((t) => t.status !== 'done').length

  return (
    <div className="board">
      <div className="board-head">
        <strong>todo</strong>
        <span className="dim">{open} open</span>
      </div>

      <div className="board-list">
        {data.todos.length === 0 && <div className="board-empty">Nothing yet. Add one below.</div>}
        {data.todos.map((t) => (
          <div key={t.id} className={`row row-${t.status}`}>
            <button
              className={`chip chip-${t.status}`}
              onClick={() => cycle(t.id)}
              title={`${t.status} — click to advance`}
            >
              {GLYPH[t.status]} {t.status}
            </button>
            <span className="row-text">{t.text}</span>
            <button className="pane-x" onClick={() => remove(t.id)} title="Delete">
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="board-add">
        <input
          value={draft}
          placeholder="new todo…"
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
