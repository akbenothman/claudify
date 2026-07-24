import { useState } from 'react'
import type { Habit } from '../../../shared/types'
import { Icon } from './Icon'
import { Blank, Card, Meter, Page, Stat } from './Page'
import { dayKey, daysAgo, newId, nowIso, useDashboard } from '../useDashboard'

/**
 * Habits. A row per habit, a dot per day, and the last five weeks visible at
 * once — the point of a habit tracker is the shape of the run, not today's
 * checkbox, so today is just the rightmost (and clickable) dot.
 */

const WEEKS = 5
const DAYS = WEEKS * 7

/** Consecutive days ending today (or yesterday — today isn't over yet). */
function streakOf(done: Set<string>): number {
  let n = 0
  for (let i = done.has(dayKey()) ? 0 : 1; i < 400; i++) {
    if (!done.has(daysAgo(i))) break
    n++
  }
  return n
}

export function HabitsPane() {
  const { data, update } = useDashboard()
  const [draft, setDraft] = useState('')

  const habits = data?.habits ?? []
  const today = dayKey()
  // Oldest first, so the grid reads left-to-right like a calendar.
  const window = Array.from({ length: DAYS }, (_, i) => daysAgo(DAYS - 1 - i))

  const toggle = (h: Habit, day: string) =>
    update((d) => ({
      ...d,
      habits: d.habits.map((x) =>
        x.id === h.id
          ? {
              ...x,
              done: x.done.includes(day) ? x.done.filter((k) => k !== day) : [...x.done, day],
              updated: nowIso()
            }
          : x
      )
    }))

  const add = () => {
    const name = draft.trim()
    if (!name) return
    setDraft('')
    update((d) => ({
      ...d,
      habits: [...d.habits, { id: newId(), name, targetPerWeek: 7, done: [], updated: nowIso() }]
    }))
  }

  const remove = (id: string) =>
    update((d) => ({ ...d, habits: d.habits.filter((h) => h.id !== id) }))

  const doneToday = habits.filter((h) => h.done.includes(today)).length
  const best = habits.reduce((n, h) => Math.max(n, streakOf(new Set(h.done))), 0)
  const todayPct = habits.length ? (doneToday / habits.length) * 100 : 0

  return (
    <Page
      kind="habits"
      title="Habits"
      subtitle={
        habits.length === 0
          ? 'The small things, tracked daily'
          : `${doneToday} of ${habits.length} done today`
      }
      actions={
        <div className="page-add">
          <input
            value={draft}
            placeholder="New habit…"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Enter') add()
            }}
          />
          <button className="primary" onClick={add}>
            <Icon name="plus" size={12} /> Add
          </button>
        </div>
      }
    >
      {habits.length > 0 && (
        <div className="stat-row">
          <Stat
            label="Today"
            value={`${doneToday}/${habits.length}`}
            tone={doneToday === habits.length ? 'up' : 'accent'}
            hint={<Meter pct={todayPct} tone={doneToday === habits.length ? 'up' : undefined} />}
          />
          <Stat label="Longest streak" value={`${best}d`} tone={best > 0 ? 'up' : undefined} />
          <Stat label="Tracking" value={habits.length} hint="habits" />
        </div>
      )}

      {habits.length === 0 && (
        <Blank
          icon="habits"
          text="No habits yet"
          hint="Add one above. Click a dot to mark a day done — today is the last one."
        />
      )}

      {habits.length > 0 && (
        <Card title="Last five weeks" action={<span className="dim">click any day</span>}>
          <div className="habit-list">
            {habits.map((h) => {
              const done = new Set(h.done)
              const streak = streakOf(done)
              const last7 = window.slice(-7).filter((d) => done.has(d)).length
              const target = h.targetPerWeek ?? 7
              return (
                <div key={h.id} className="habit">
                  <div className="habit-name">
                    <span className={`habit-flame${streak > 0 ? ' lit' : ''}`}>
                      <Icon name="flame" size={13} />
                    </span>
                    <span className="habit-title">{h.name}</span>
                    <span className="habit-streak">{streak > 0 ? `${streak}d streak` : '—'}</span>
                  </div>

                  <div className="habit-grid">
                    {window.map((day) => (
                      <button
                        key={day}
                        className={`hd${done.has(day) ? ' on' : ''}${day === today ? ' today' : ''}`}
                        title={`${day}${done.has(day) ? ' · done' : ''}`}
                        onClick={() => toggle(h, day)}
                      />
                    ))}
                  </div>

                  <div className="habit-week">
                    <span className={last7 >= target ? 'ok' : 'dim'}>
                      {last7}/{target} this week
                    </span>
                    <button className="ghost-x" title="Delete habit" onClick={() => remove(h.id)}>
                      <Icon name="close" size={11} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </Page>
  )
}
