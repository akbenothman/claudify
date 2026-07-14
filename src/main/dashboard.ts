import { app, type BrowserWindow } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, watch, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { Dashboard } from '../shared/types'

/**
 * The dashboard is backed by a plain JSON file rather than a bespoke IPC
 * protocol, because the point is that CLAUDE can change things. A file is an
 * interface every agent already has tools for — no MCP server, no CLI shim. The
 * app watches it and re-renders when it changes on disk.
 */

const INSTRUCTIONS = [
  'This file is the live state of the Claudify "AK Dashboard". Claude may edit it directly.',
  'Edit this file and the dashboard UI updates immediately — no restart needed.',
  'topics[] are the tabs of the todo pane; each has its own todos[].',
  'topics[].todos[].status must be one of: todo | doing | blocked | done',
  'notes[] are the tabs of the notepad pane; body is plain text (newlines allowed).',
  'conversations[].status must be one of: active | waiting | done',
  'Keep ids stable. Set updated to an ISO-8601 timestamp when you change a row.'
].join(' ')

const EMPTY: Dashboard = {
  _instructions: INSTRUCTIONS,
  topics: [{ id: 'general', name: 'General', todos: [] }],
  notes: [{ id: 'scratch', name: 'Scratch', body: '' }],
  conversations: []
}

export function dashboardPath(): string {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return path.join(dir, 'dashboard.json')
}

/** Content we last wrote ourselves, so our own writes don't echo back as changes. */
let lastWritten = ''

export function readDashboard(): Dashboard {
  const file = dashboardPath()
  try {
    const raw = readFileSync(file, 'utf8')
    const parsed = JSON.parse(raw) as Partial<Dashboard>

    const topics = Array.isArray(parsed.topics) ? parsed.topics.filter((t) => t && t.id) : []

    /*
     * A dashboard written before topics existed has a flat `todos` array. Fold
     * it into a topic rather than dropping it on the floor — this file is the
     * user's actual list, and an agent may still write the old shape.
     */
    const legacy = Array.isArray(parsed.todos) ? parsed.todos : []
    if (legacy.length > 0) {
      const general = topics.find((t) => t.id === 'general')
      if (general) {
        const known = new Set(general.todos?.map((t) => t.id))
        general.todos = [...(general.todos ?? []), ...legacy.filter((t) => !known.has(t.id))]
      } else {
        topics.unshift({ id: 'general', name: 'General', todos: legacy })
      }
    }

    const notes = Array.isArray(parsed.notes) ? parsed.notes.filter((n) => n && n.id) : []

    return {
      _instructions: INSTRUCTIONS,
      // Never hand back an empty tab strip: a pane with no tabs has nothing to
      // click, and no way back to a usable state.
      topics: topics.length > 0 ? topics.map((t) => ({ ...t, todos: t.todos ?? [] })) : EMPTY.topics,
      notes: notes.length > 0 ? notes.map((n) => ({ ...n, body: n.body ?? '' })) : EMPTY.notes,
      conversations: Array.isArray(parsed.conversations) ? parsed.conversations : []
    }
  } catch {
    // Missing or malformed (quite likely mid-edit by an agent) — hand back the
    // last good shape rather than throwing into the UI.
    return structuredClone(EMPTY)
  }
}

export function writeDashboard(data: Dashboard): void {
  const file = dashboardPath()
  // `todos` is read-only legacy: fold it in on read, never write it back, or the
  // two copies drift and the pane shows a list nobody edited.
  const { todos: _legacy, ...rest } = data
  const body = JSON.stringify({ ...rest, _instructions: INSTRUCTIONS }, null, 2)
  lastWritten = body
  const tmp = `${file}.tmp`
  writeFileSync(tmp, body, 'utf8')
  renameSync(tmp, file)
}

export function ensureDashboard(): void {
  if (!existsSync(dashboardPath())) writeDashboard(structuredClone(EMPTY))
}

/**
 * Watches the file and notifies the renderer. Debounced, because a single save
 * from an editor typically fires several fs events.
 */
export function watchDashboard(win: BrowserWindow): void {
  ensureDashboard()
  const file = dashboardPath()
  let timer: ReturnType<typeof setTimeout> | undefined

  try {
    watch(path.dirname(file), (_event, filename) => {
      if (filename !== path.basename(file)) return
      clearTimeout(timer)
      timer = setTimeout(() => {
        let raw = ''
        try {
          raw = readFileSync(file, 'utf8')
        } catch {
          return // mid-write; the next event will catch it
        }
        // Don't bounce our own save back into the renderer.
        if (raw === lastWritten) return
        if (!win.isDestroyed()) win.webContents.send('dashboard:changed', readDashboard())
      }, 120)
    })
  } catch {
    // Watching is a nicety; the dashboard still works without live reload.
  }
}
