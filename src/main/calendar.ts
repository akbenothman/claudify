import { app, type BrowserWindow } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, watch, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { Calendar } from '../shared/types'

/**
 * The calendar's control surface, same bet as the dashboard: a watched JSON
 * file. Claudify never calls Google — an agent with the Google Calendar MCP
 * fills `events[]` from the user's calendar and fulfils the add/delete requests
 * the pane writes into `requests[]`. The app just reads and renders, live.
 */

const INSTRUCTIONS = [
  'Claudify calendar, backed by this file. An agent with the Google Calendar MCP owns it.',
  'events[] are upcoming events: {id, title, start (ISO-8601), end?, location?, source?}. Keep them sorted by start.',
  'requests[] are user asks to fulfil via the MCP, then mark status "done"/"error":',
  '{"id":"..","action":"add","title":"..","start":"ISO","end":"ISO?","location":"?"} — create it in Google Calendar, then append it to events[].',
  '{"id":"..","action":"delete","eventId":".."} — remove it from Google Calendar and from events[].',
  'Set syncedAt to an ISO timestamp whenever you refresh events[].'
].join(' ')

const EMPTY: Calendar = { _instructions: INSTRUCTIONS, events: [], requests: [] }

export function calendarPath(): string {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return path.join(dir, 'calendar.json')
}

let lastWritten = ''

export function readCalendar(): Calendar {
  try {
    const parsed = JSON.parse(readFileSync(calendarPath(), 'utf8')) as Partial<Calendar>
    return {
      _instructions: INSTRUCTIONS,
      events: Array.isArray(parsed.events) ? parsed.events.filter((e) => e && e.id) : [],
      requests: Array.isArray(parsed.requests) ? parsed.requests.filter((r) => r && r.id) : [],
      syncedAt: parsed.syncedAt
    }
  } catch {
    return structuredClone(EMPTY)
  }
}

export function writeCalendar(data: Calendar): void {
  const body = JSON.stringify({ ...data, _instructions: INSTRUCTIONS }, null, 2)
  lastWritten = body
  const file = calendarPath()
  const tmp = `${file}.tmp`
  writeFileSync(tmp, body, 'utf8')
  renameSync(tmp, file)
}

export function ensureCalendar(): void {
  if (!existsSync(calendarPath())) writeCalendar(structuredClone(EMPTY))
}

export function watchCalendar(win: BrowserWindow): void {
  ensureCalendar()
  const file = calendarPath()
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
          return
        }
        if (raw === lastWritten) return
        if (!win.isDestroyed()) win.webContents.send('calendar:changed', readCalendar())
      }, 120)
    })
  } catch {
    /* live reload is a nicety; the pane still works without it */
  }
}
