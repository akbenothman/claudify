import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CalEvent } from '../../../shared/types'
import { newId } from '../useDashboard'
import { useCalendar } from '../useCalendar'
import { useStore, type PaneStatus } from '../store'
import { sendToPane } from '../paneInput'

/**
 * Auto-sync cadence. We never nag: the calendar refreshes itself on a timer as
 * long as the dashboard Claude is up and idle, so the grid stays current
 * without the user ever clicking sync.
 */
const CHECK_MS = 5 * 60 * 1000 // re-evaluate whether a sync is due this often
const STALE_MS = 20 * 60 * 1000 // events older than this are worth refreshing
const COOLDOWN_MS = 3 * 60 * 1000 // don't re-fire while a dispatch is in flight
const FIRST_DELAY_MS = 9000 // give Claude a moment to boot before the first sync

/**
 * The dashboard's Claude pane (the one launched with a persisted `claude`
 * command) and what it's currently doing — so auto-sync can wait for it to be
 * present and not interrupt it mid-task.
 */
function findDashClaude(): { paneId?: string; status?: PaneStatus } {
  const dash = useStore.getState().workspaces.find((w) => w.permanent)
  for (const t of dash?.tabs ?? []) {
    for (const p of Object.values(t.panes)) {
      if (p.kind === 'terminal' && p.persistCommand) return { paneId: p.id, status: p.status }
    }
  }
  return {}
}

/**
 * A Google-Calendar-style month grid, with a Claude-written summary and an
 * agenda for the selected day beneath it. Claudify never talks to Google: an
 * agent with the Calendar MCP fills `events[]` (and `summary`) in calendar.json,
 * and the pane writes add/delete requests back for it to fulfil.
 */

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const pad = (n: number): string => String(n).padStart(2, '0')
const keyOf = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/**
 * Parse an event's start into a local Date. A date-only string (all-day event)
 * is built from its parts so it doesn't slide a day under UTC parsing; anything
 * with a time is left to the Date parser.
 */
function toDate(iso: string): Date | null {
  if (!iso) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (m && !/\d{2}:\d{2}/.test(iso)) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  }
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

/** A time like "9:30 AM", or "all day" when the ISO carries no time part. */
function timeLabel(iso: string): string {
  if (!/\d{2}:\d{2}/.test(iso)) return 'all day'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function humanDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const today = keyOf(new Date())
  const tomorrow = keyOf(new Date(Date.now() + 86_400_000))
  if (key === today) return 'Today'
  if (key === tomorrow) return 'Tomorrow'
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
}

export function CalendarPane() {
  const { data, update } = useCalendar()
  const [title, setTitle] = useState('')
  const [when, setWhen] = useState('')
  const [path, setPath] = useState('')
  const [note, setNote] = useState('')
  const todayKey = keyOf(new Date())
  // The month on screen (anchored to its 1st) and the highlighted day.
  const [view, setView] = useState(() => {
    const n = new Date()
    return new Date(n.getFullYear(), n.getMonth(), 1)
  })
  const [selected, setSelected] = useState(todayKey)

  useEffect(() => {
    window.claudify.calendarPath().then(setPath)
  }, [])

  // Events bucketed by local day, so each cell and the agenda can read O(1).
  const byDay = useMemo(() => {
    const map: Record<string, CalEvent[]> = {}
    for (const e of data?.events ?? []) {
      const d = toDate(e.start)
      if (!d) continue
      ;(map[keyOf(d)] ||= []).push(e)
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    }
    return map
  }, [data?.events])

  // Six weeks starting on the Sunday on or before the 1st — a stable 6x7 grid.
  const cells = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1)
    const start = new Date(first)
    start.setDate(1 - first.getDay())
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return d
    })
  }, [view])

  const lastDispatch = useRef(0)

  /**
   * Sync with the real Google Calendar. Claudify never calls Google itself — it
   * asks the dashboard's Claude (which has your account's Calendar connector) to
   * read your events and write them into this file, by typing the request into
   * that pane. The grid fills in when the agent finishes.
   */
  const dispatchSync = useCallback(
    (paneId: string): boolean => {
      if (!path) return false
      const msg =
        `Sync my Google Calendar into "${path}": use the Google Calendar MCP to read my ` +
        `events for the next 30 days, overwrite events[] as {id,title,start (ISO-8601),end,location}, ` +
        `set syncedAt to now, and write a one-line summary of the week into summary. ` +
        `The file's _instructions field has the schema. Then fulfil any pending requests[].`
      const ok = sendToPane(paneId, msg)
      if (ok) lastDispatch.current = Date.now()
      return ok
    },
    [path]
  )

  /**
   * Keep the calendar current on its own. Every few minutes, if the dashboard
   * Claude is up and not mid-task and the events have gone stale, quietly ask it
   * to re-sync — no button, no prompt from the user. The status gate means we
   * never type over an agent that's busy, and the cooldown stops a re-fire while
   * a sync we already sent is still running. These hooks live ABOVE the early
   * return below so the hook order stays stable across the loading state.
   */
  const syncedAt = data?.syncedAt
  useEffect(() => {
    if (!path) return
    let cancelled = false
    const tick = (): void => {
      if (cancelled) return
      const { paneId, status } = findDashClaude()
      if (!paneId) return
      if (status === 'working' || status === 'blocked') return // don't interrupt
      if (Date.now() - lastDispatch.current < COOLDOWN_MS) return
      const last = syncedAt ? Date.parse(syncedAt) : 0
      if (Number.isFinite(last) && Date.now() - last < STALE_MS) return
      dispatchSync(paneId)
    }
    const first = setTimeout(tick, FIRST_DELAY_MS)
    const iv = setInterval(tick, CHECK_MS)
    return () => {
      cancelled = true
      clearTimeout(first)
      clearInterval(iv)
    }
  }, [path, syncedAt, dispatchSync])

  if (!data) return <div className="board calendar empty">loading…</div>

  const selectedEvents = byDay[selected] ?? []
  const pending = data.requests.filter((r) => !r.status || r.status === 'pending')

  const shiftMonth = (delta: number): void =>
    setView((v) => new Date(v.getFullYear(), v.getMonth() + delta, 1))

  const goToday = (): void => {
    const n = new Date()
    setView(new Date(n.getFullYear(), n.getMonth(), 1))
    setSelected(todayKey)
  }

  const pickDay = (d: Date): void => {
    setSelected(keyOf(d))
    // Nudge the month view along if they clicked a spillover day.
    if (d.getMonth() !== view.getMonth()) setView(new Date(d.getFullYear(), d.getMonth(), 1))
    // Prefill the add box so "add event" lands on the day you clicked.
    setWhen(keyOf(d))
  }

  const add = (): void => {
    const t = title.trim()
    if (!t) return
    const start = when.trim()
    setTitle('')
    setWhen('')
    update((c) => ({
      ...c,
      requests: [...c.requests, { id: newId(), action: 'add', title: t, start, status: 'pending' }]
    }))
  }

  const remove = (eventId: string): void =>
    update((c) => ({
      ...c,
      requests: [...c.requests, { id: newId(), action: 'delete', eventId, status: 'pending' }]
    }))

  const syncGoogle = (): void => {
    const { paneId } = findDashClaude()
    if (!paneId) {
      setNote('Open the dashboard Claude pane first.')
      setTimeout(() => setNote(''), 6000)
      return
    }
    const ok = dispatchSync(paneId)
    setNote(ok ? 'Asked Claude to sync your Google Calendar…' : 'Open the dashboard Claude pane first.')
    setTimeout(() => setNote(''), 6000)
  }

  const monthLabel = view.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  return (
    <div className="board calendar">
      <div className="board-head cal-monthhead">
        <button className="cal-nav" onClick={() => shiftMonth(-1)} title="Previous month">
          ‹
        </button>
        <strong className="cal-monthname">{monthLabel}</strong>
        <button className="cal-nav" onClick={() => shiftMonth(1)} title="Next month">
          ›
        </button>
        <button className="cal-today-btn" onClick={goToday} title="Jump to today">
          today
        </button>
        <span className="spacer" />
        <span className="dim cal-sync">
          {data.syncedAt
            ? `synced ${new Date(data.syncedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
            : 'not synced'}
        </span>
        <button
          className="cal-sync-btn"
          onClick={syncGoogle}
          title="Ask the dashboard Claude to sync your Google Calendar into this file"
        >
          ⟳ sync
        </button>
      </div>

      {note && <div className="cal-note dim">{note}</div>}

      <div className="cal-grid">
        <div className="cal-weekrow cal-weekhead">
          {WEEKDAYS.map((w) => (
            <div key={w} className="cal-weekday">
              {w}
            </div>
          ))}
        </div>
        <div className="cal-weeks">
          {cells.map((d) => {
            const k = keyOf(d)
            const evs = byDay[k] ?? []
            const cls = [
              'cal-cell',
              d.getMonth() === view.getMonth() ? '' : 'cal-out',
              k === todayKey ? 'cal-today' : '',
              k === selected ? 'cal-sel' : '',
              evs.length ? 'cal-has' : ''
            ]
              .filter(Boolean)
              .join(' ')
            return (
              <button key={k} className={cls} onClick={() => pickDay(d)}>
                <span className="cal-daynum">{d.getDate()}</span>
                <span className="cal-daydots">
                  {evs.slice(0, 3).map((e) => (
                    <span key={e.id} className="cal-dot" title={e.title} />
                  ))}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Claude's digest of what's ahead — the agent writes calendar.json.summary. */}
      <div className="cal-summary">
        <span className="cal-summary-label">summary</span>
        {data.summary ? (
          <span className="cal-summary-text">{data.summary}</span>
        ) : (
          <span className="dim">
            Syncing your Google Calendar automatically — the week&apos;s summary appears here.
          </span>
        )}
      </div>

      {pending.length > 0 && (
        <div className="cal-pending dim">
          {pending.length} request{pending.length === 1 ? '' : 's'} waiting for the calendar agent…
        </div>
      )}

      <div className="cal-agenda-head">{humanDay(selected)}</div>
      <div className="board-list cal-agenda">
        {selectedEvents.length === 0 && <div className="board-empty">Nothing scheduled.</div>}
        {selectedEvents.map((e) => (
          <div key={e.id} className="cal-event">
            <span className="cal-time">{timeLabel(e.start)}</span>
            <span className="cal-title">
              {e.title}
              {e.location && <span className="cal-loc"> · {e.location}</span>}
            </span>
            <button className="pane-x row-del" onClick={() => remove(e.id)} title="Delete event">
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="board-add cal-add">
        <input
          value={title}
          placeholder="new event…"
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter') add()
          }}
        />
        <input
          className="cal-when"
          value={when}
          placeholder="when (e.g. tomorrow 3pm)"
          onChange={(e) => setWhen(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter') add()
          }}
        />
        <button onClick={add}>add</button>
      </div>

      <div className="board-foot dim" title={path}>
        Calendar agent edits: <code>{path}</code>
      </div>
    </div>
  )
}
