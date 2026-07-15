import { app, Notification, type BrowserWindow } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, watch, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { ControlFile, ControlRequest } from '../shared/types'

/**
 * The control surface: the whole app's version of the dashboard's bet. An agent
 * drives the terminal — raises a notification, sets a pane's status, types into
 * a pane, brings one on screen — by appending a request to a watched JSON file.
 * No MCP server, no CLI shim: a file every agent's Write tool already reaches,
 * so it works with Claude, Codex, Gemini, or anything else on day one.
 *
 * The app is the single writer of results. Agents append requests; we forward
 * each new one to the renderer (which owns the panes), then record `status` and
 * `result` back into the file so the agent can see what happened.
 */

const INSTRUCTIONS = [
  'Claudify control surface. Append an object to requests[] to drive the terminal;',
  'claudify acts on it and writes back status ("done"/"error") and result. Keep ids unique.',
  'Actions:',
  '{"id":"..","action":"notify","title":"..","body":".."} — desktop toast + taskbar flash.',
  '{"id":"..","action":"status","match":"<pane cwd/title/branch substring>","state":"idle|working|blocked|finished"}.',
  '{"id":"..","action":"message","match":"<pane substring>","text":".."} — types text into that pane and presses Enter.',
  '{"id":"..","action":"focus","match":"<pane substring>"} — brings that pane on screen.'
].join(' ')

const EMPTY: ControlFile = { _instructions: INSTRUCTIONS, requests: [] }

export function controlPath(): string {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return path.join(dir, 'control.json')
}

let lastWritten = ''

function read(): ControlFile {
  try {
    const raw = readFileSync(controlPath(), 'utf8')
    const parsed = JSON.parse(raw) as Partial<ControlFile>
    return {
      _instructions: INSTRUCTIONS,
      requests: Array.isArray(parsed.requests) ? parsed.requests.filter((r) => r && r.id) : []
    }
  } catch {
    return structuredClone(EMPTY)
  }
}

function write(data: ControlFile): void {
  // Cap history so an agent that spams requests can't grow the file without
  // bound; the newest are the ones anyone cares about.
  const requests = data.requests.slice(-50)
  const body = JSON.stringify({ _instructions: INSTRUCTIONS, requests }, null, 2)
  lastWritten = body
  const file = controlPath()
  const tmp = `${file}.tmp`
  writeFileSync(tmp, body, 'utf8')
  renameSync(tmp, file)
}

export function ensureControl(): void {
  if (!existsSync(controlPath())) write(structuredClone(EMPTY))
}

/** Ids we've already forwarded or that arrived already-resolved. */
const seen = new Set<string>()

/** Record the outcome of a request the renderer just handled. */
export function resolveControl(id: string, ok: boolean, message: string): void {
  const data = read()
  const req = data.requests.find((r) => r.id === id)
  if (!req) return
  req.status = ok ? 'done' : 'error'
  req.result = message
  req.resolvedAt = new Date().toISOString()
  write(data)
}

function forwardNew(win: BrowserWindow): void {
  const data = read()
  for (const req of data.requests) {
    if (seen.has(req.id)) continue
    seen.add(req.id)
    // Already-resolved requests (from a previous run) are history, not work.
    if (req.status) continue
    if (!win.isDestroyed()) win.webContents.send('control:request', req as ControlRequest)
  }
}

export function watchControl(win: BrowserWindow): void {
  ensureControl()
  // Everything already in the file at startup is history — never re-fire it.
  for (const r of read().requests) seen.add(r.id)

  const file = controlPath()
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
          return // mid-write; the next event catches it
        }
        if (raw === lastWritten) return // our own result write
        forwardNew(win)
      }, 120)
    })
  } catch {
    // Watching is a nicety; requests still land on the next restart's scan.
  }
}

/** Raise a desktop notification and flash the taskbar. */
export function notify(win: BrowserWindow | null, title: string, body: string): void {
  try {
    if (Notification.isSupported()) new Notification({ title, body }).show()
  } catch {
    /* platform without notification support */
  }
  // Flash only when the window isn't already the thing you're looking at.
  if (win && !win.isDestroyed() && !win.isFocused()) win.flashFrame(true)
}
