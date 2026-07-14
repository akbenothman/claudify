import { useEffect, useRef, useState } from 'react'
import { newId, nowIso, useDashboard } from '../useDashboard'

/**
 * The notepad. Pages are tabs, bodies are plain text, and everything lives in
 * dashboard.json alongside the todos — so Claude can read and write your notes
 * with nothing but a file edit.
 *
 * Typing is held locally and flushed on a debounce: writing through to the file
 * on every keystroke would round-trip the whole dashboard, and the watcher would
 * echo it straight back into the textarea under your cursor.
 */
const SAVE_MS = 400

export function NotesPane() {
  const { data, update } = useDashboard()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [body, setBody] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const notes = data?.notes ?? []
  const note = notes.find((n) => n.id === activeId) ?? notes[0]

  // Adopt the file's copy whenever we switch page, or an agent edits the one
  // we're on — but not while we have unflushed keystrokes of our own.
  useEffect(() => {
    if (!note) return
    if (timer.current) return
    setBody(note.body)
  }, [note?.id, note?.body]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => clearTimeout(timer.current), [])

  if (!data) return <div className="board empty">loading…</div>

  const flush = (id: string, text: string) => {
    update((d) => ({
      ...d,
      notes: d.notes.map((n) => (n.id === id ? { ...n, body: text, updated: nowIso() } : n))
    }))
  }

  const onType = (text: string) => {
    setBody(text)
    if (!note) return
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      timer.current = undefined
      flush(note.id, text)
    }, SAVE_MS)
  }

  const addNote = () => {
    const n = { id: newId(), name: 'new note', body: '', updated: nowIso() }
    update((d) => ({ ...d, notes: [...d.notes, n] }))
    setActiveId(n.id)
    setBody('')
    setEditing(n.id)
  }

  const renameNote = (id: string, name: string) =>
    update((d) => ({ ...d, notes: d.notes.map((n) => (n.id === id ? { ...n, name } : n)) }))

  const removeNote = (id: string) => {
    if (notes.length <= 1) return // never leave the pane tabless
    update((d) => ({ ...d, notes: d.notes.filter((n) => n.id !== id) }))
    if (activeId === id) {
      setActiveId(null)
      setBody(null)
    }
  }

  const words = (body ?? '').trim() ? (body ?? '').trim().split(/\s+/).length : 0

  return (
    <div className="board notes">
      <div className="board-tabs">
        {notes.map((n) => (
          <div
            key={n.id}
            className={`board-tab${n.id === note?.id ? ' active' : ''}`}
            onClick={() => {
              // Don't carry unsaved text across to another page.
              clearTimeout(timer.current)
              if (timer.current && note && body !== null) flush(note.id, body)
              timer.current = undefined
              setActiveId(n.id)
              setBody(n.body)
            }}
            onDoubleClick={() => setEditing(n.id)}
          >
            {editing === n.id ? (
              <input
                className="rename"
                autoFocus
                defaultValue={n.name}
                onClick={(e) => e.stopPropagation()}
                onBlur={(e) => {
                  const v = e.target.value.trim()
                  if (v) renameNote(n.id, v)
                  setEditing(null)
                }}
                onKeyDown={(e) => {
                  e.stopPropagation()
                  // Commit outright; see the note in TodoPane — blur is not a
                  // reliable commit path when the input was never focused.
                  if (e.key === 'Enter') {
                    const v = (e.target as HTMLInputElement).value.trim()
                    if (v) renameNote(n.id, v)
                    setEditing(null)
                  }
                  if (e.key === 'Escape') setEditing(null)
                }}
              />
            ) : (
              <>
                <span className="board-tab-name">{n.name}</span>
                {notes.length > 1 && (
                  <button
                    className="pane-x"
                    title="Delete note"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeNote(n.id)
                    }}
                  >
                    ×
                  </button>
                )}
              </>
            )}
          </div>
        ))}
        <button className="board-tab-new" onClick={addNote} title="New note">
          +
        </button>
      </div>

      <textarea
        className="notes-body"
        value={body ?? note?.body ?? ''}
        placeholder="Notes. Claude can read and edit these too."
        spellCheck={false}
        onChange={(e) => onType(e.target.value)}
        // The terminal grabs global keys; keep them off this textarea.
        onKeyDown={(e) => e.stopPropagation()}
      />

      <div className="board-foot">
        <span className="dim">{words} words</span>
      </div>
    </div>
  )
}
