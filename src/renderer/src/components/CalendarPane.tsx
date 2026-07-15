import { useEffect, useState } from 'react'
import { newId } from '../useDashboard'
import { useCalendar } from '../useCalendar'

/** Group events under Today / Tomorrow / a weekday+date heading. */
function dayLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'someday'
  const today = new Date()
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((startOf(d) - startOf(today)) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

/** A time like "9:30 AM", or "all day" when the ISO has no time part. */
function timeLabel(iso: string): string {
  if (!/\d{2}:\d{2}/.test(iso)) return 'all day'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export function CalendarPane() {
  const { data, update } = useCalendar()
  const [title, setTitle] = useState('')
  const [when, setWhen] = useState('')
  const [path, setPath] = useState('')

  useEffect(() => {
    window.claudify.calendarPath().then(setPath)
  }, [])

  if (!data) return <div className="board empty">loading…</div>

  // Only what's ahead, soonest first.
  const now = Date.now()
  const upcoming = [...data.events]
    .filter((e) => {
      const t = new Date(e.end || e.start).getTime()
      return Number.isNaN(t) || t >= now - 3_600_000
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())

  // Group consecutively by day.
  const groups: { label: string; events: typeof upcoming }[] = []
  for (const e of upcoming) {
    const label = dayLabel(e.start)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.events.push(e)
    else groups.push({ label, events: [e] })
  }

  const pending = data.requests.filter((r) => !r.status || r.status === 'pending')

  const add = () => {
    const t = title.trim()
    if (!t) return
    // Accept a plain "2026-07-20 15:00" and normalise to ISO-ish; leave blank
    // for the agent to interpret ("tomorrow 3pm") if the user typed prose.
    const start = when.trim()
    setTitle('')
    setWhen('')
    update((c) => ({
      ...c,
      requests: [...c.requests, { id: newId(), action: 'add', title: t, start, status: 'pending' }]
    }))
  }

  const remove = (eventId: string) =>
    update((c) => ({
      ...c,
      requests: [...c.requests, { id: newId(), action: 'delete', eventId, status: 'pending' }]
    }))

  return (
    <div className="board calendar">
      <div className="board-head">
        <strong>calendar</strong>
        <span className="dim">
          {data.syncedAt
            ? `synced ${new Date(data.syncedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
            : 'not synced'}
        </span>
      </div>

      {pending.length > 0 && (
        <div className="cal-pending dim">
          {pending.length} request{pending.length === 1 ? '' : 's'} waiting for the calendar agent…
        </div>
      )}

      <div className="board-list">
        {upcoming.length === 0 && (
          <div className="board-empty">
            No events. Ask the Claude on the left to sync your Google Calendar — it can fill this
            file via the Calendar MCP.
          </div>
        )}
        {groups.map((g) => (
          <div key={g.label} className="cal-group">
            <div className="cal-day">{g.label}</div>
            {g.events.map((e) => (
              <div key={e.id} className="cal-event">
                <span className="cal-time">{timeLabel(e.start)}</span>
                <span className="cal-title">
                  {e.title}
                  {e.location && <span className="cal-loc"> · {e.location}</span>}
                </span>
                <button className="pane-x" onClick={() => remove(e.id)} title="Delete event">
                  ×
                </button>
              </div>
            ))}
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
