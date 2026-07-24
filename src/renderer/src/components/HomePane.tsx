import { useState } from 'react'
import type { PaneKind, Todo } from '../../../shared/types'
import { Icon, PAGE_ICONS } from './Icon'
import { Card, Meter, Page, Stat } from './Page'
import { dayKey, money, moneyExact, newId, nowIso, perMonth, useDashboard } from '../useDashboard'
import { useCalendar } from '../useCalendar'
import { useStore } from '../store'

/**
 * Home. The one screen that answers "what should I be looking at?" — pulled
 * from every other page, and clickable straight through to the page it came
 * from. Nothing lives here: every number is derived, so home can never
 * disagree with the page it summarises.
 */

/** Switch the dashboard to the tab holding a given page. */
function openPage(kind: PaneKind): void {
  const s = useStore.getState()
  const ws = s.workspaces.find((w) => w.permanent)
  if (!ws) return
  const tab = ws.tabs.find((t) => Object.values(t.panes).some((p) => p.kind === kind))
  if (!tab) return
  s.setActiveWorkspace(ws.id)
  s.setActiveTab(ws.id, tab.id)
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Still up'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

const LONG_DATE: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  month: 'long',
  day: 'numeric'
}

/** Start-of-day for an event ISO, tolerating all-day strings with no time. */
function eventTime(iso: string): { at: Date | null; allDay: boolean } {
  if (!iso) return { at: null, allDay: false }
  const allDay = !/\d{2}:\d{2}/.test(iso)
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (allDay && m) return { at: new Date(+m[1], +m[2] - 1, +m[3]), allDay }
  const d = new Date(iso)
  return { at: Number.isNaN(d.getTime()) ? null : d, allDay }
}

export function HomePane() {
  const { data, update } = useDashboard()
  const { data: cal } = useCalendar()
  const [draft, setDraft] = useState('')

  if (!data) return <div className="page loading">loading…</div>

  const currency = data.finance?.currency ?? '$'
  const today = dayKey()

  /* --- todos, flattened across topics so home shows the real workload --- */
  const all = data.topics.flatMap((t) => t.todos.map((todo) => ({ todo, topic: t })))
  const open = all.filter(({ todo }) => todo.status !== 'done')
  const doing = open.filter(({ todo }) => todo.status === 'doing')
  const blocked = open.filter(({ todo }) => todo.status === 'blocked')
  // Doing first, then blocked, then the rest: that's the order you'd work them.
  const focus = [...doing, ...blocked, ...open.filter(({ todo }) => todo.status === 'todo')].slice(0, 6)

  /* --- habits --- */
  const habits = data.habits ?? []
  const habitsDone = habits.filter((h) => h.done.includes(today)).length

  /* --- goals --- */
  const goals = (data.goals ?? []).filter((g) => g.horizon !== 'someday')
  const goalPct = goals.length
    ? Math.round(
        goals.reduce((n, g) => {
          const ms = g.milestones ?? []
          return n + (ms.length ? (ms.filter((m) => m.done).length / ms.length) * 100 : g.progress)
        }, 0) / goals.length
      )
    : 0

  /* --- money --- */
  const fin = data.finance ?? { accounts: [], recurring: [] }
  const assets = fin.accounts.filter((a) => !a.liability).reduce((n, a) => n + a.balance, 0)
  const debts = fin.accounts.filter((a) => a.liability).reduce((n, a) => n + a.balance, 0)
  const net = assets - debts
  const surplus = fin.recurring.reduce(
    (n, r) => n + perMonth(r.amount, r.cadence) * (r.direction === 'in' ? 1 : -1),
    0
  )
  const mrr = (data.ventures ?? []).reduce((n, v) => n + (v.mrr ?? 0), 0)

  /* --- what's next on the calendar --- */
  const upcoming = (cal?.events ?? [])
    .map((e) => ({ e, ...eventTime(e.start) }))
    .filter((x) => x.at && x.at.getTime() > Date.now() - 12 * 3600_000)
    .sort((a, b) => (a.at as Date).getTime() - (b.at as Date).getTime())
    .slice(0, 4)

  const capture = () => {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    const todo: Todo = { id: newId(), text, status: 'todo', updated: nowIso() }
    update((d) => ({
      ...d,
      // Quick capture always lands in the first topic — deciding where it goes
      // is exactly the friction that stops things being written down.
      topics: d.topics.map((t, i) => (i === 0 ? { ...t, todos: [...t.todos, todo] } : t))
    }))
  }

  const cycle = (id: string) =>
    update((d) => ({
      ...d,
      topics: d.topics.map((t) => ({
        ...t,
        todos: t.todos.map((x) =>
          x.id === id
            ? {
                ...x,
                status: x.status === 'done' ? 'todo' : x.status === 'doing' ? 'done' : 'doing',
                updated: nowIso()
              }
            : x
        )
      }))
    }))

  return (
    <Page
      kind="home"
      title={`${greeting()}, AK`}
      subtitle={new Date().toLocaleDateString(undefined, LONG_DATE)}
      actions={
        <div className="page-add">
          <input
            value={draft}
            placeholder="Capture a thought…"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Enter') capture()
            }}
          />
          <button className="primary" onClick={capture}>
            <Icon name="plus" size={12} /> Capture
          </button>
        </div>
      }
    >
      <div className="stat-row">
        <Stat
          label="Open tasks"
          value={open.length}
          tone={blocked.length > 0 ? 'down' : 'accent'}
          hint={
            blocked.length > 0
              ? `${blocked.length} blocked · ${doing.length} in progress`
              : `${doing.length} in progress`
          }
        />
        <Stat
          label="Habits today"
          value={habits.length ? `${habitsDone}/${habits.length}` : '—'}
          tone={habits.length > 0 && habitsDone === habits.length ? 'up' : undefined}
          hint={habits.length ? <Meter pct={(habitsDone / habits.length) * 100} /> : 'none tracked'}
        />
        <Stat
          label="Goal progress"
          value={goals.length ? `${goalPct}%` : '—'}
          tone="accent"
          hint={goals.length ? <Meter pct={goalPct} /> : 'no goals set'}
        />
        <Stat
          label="Net worth"
          value={
            fin.accounts.length ? (
              <span title={moneyExact(net, currency)}>{money(net, currency)}</span>
            ) : (
              '—'
            )
          }
          tone={fin.accounts.length ? (net >= 0 ? 'up' : 'down') : undefined}
          hint={
            fin.recurring.length
              ? `${surplus >= 0 ? '+' : ''}${money(surplus, currency)} a month`
              : 'no accounts yet'
          }
        />
      </div>

      <div className="two-col">
        <Card
          title="Today"
          action={
            <button className="ghost" onClick={() => openPage('todo')}>
              all tasks <Icon name="arrow" size={11} />
            </button>
          }
        >
          {focus.length === 0 ? (
            <div className="blank-inline">Nothing open. Capture something above.</div>
          ) : (
            <div className="home-todos">
              {focus.map(({ todo, topic }) => (
                <button key={todo.id} className={`home-todo st-${todo.status}`} onClick={() => cycle(todo.id)}>
                  <span className={`tick tick-${todo.status}`} />
                  <span className="home-todo-text">{todo.text}</span>
                  <span className="home-todo-topic">{topic.name}</span>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card
          title="Up next"
          action={
            <button className="ghost" onClick={() => openPage('calendar')}>
              calendar <Icon name="arrow" size={11} />
            </button>
          }
        >
          {upcoming.length === 0 ? (
            <div className="blank-inline">
              Nothing scheduled. Ask the dashboard Claude to sync your calendar.
            </div>
          ) : (
            <div className="home-events">
              {upcoming.map(({ e, at, allDay }) => (
                <div key={e.id} className="home-event">
                  <div className="he-when">
                    <span className="he-day">
                      {at?.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}
                    </span>
                    <span className="he-time">
                      {allDay
                        ? 'all day'
                        : at?.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="he-text">
                    <div className="he-title">{e.title}</div>
                    {e.location && <div className="he-loc">{e.location}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="two-col">
        <Card
          title="Goals"
          action={
            <button className="ghost" onClick={() => openPage('goals')}>
              open <Icon name="arrow" size={11} />
            </button>
          }
        >
          {goals.length === 0 ? (
            <div className="blank-inline">No goals yet.</div>
          ) : (
            <div className="home-goals">
              {goals.slice(0, 4).map((g) => {
                const ms = g.milestones ?? []
                const pct = ms.length
                  ? Math.round((ms.filter((m) => m.done).length / ms.length) * 100)
                  : g.progress
                return (
                  <div key={g.id} className="home-goal">
                    <div className="hg-top">
                      <span className="hg-title">{g.title}</span>
                      <span className="hg-pct">{pct}%</span>
                    </div>
                    <Meter pct={pct} tone={pct >= 100 ? 'up' : undefined} />
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        <Card
          title="Business"
          action={
            <button className="ghost" onClick={() => openPage('business')}>
              open <Icon name="arrow" size={11} />
            </button>
          }
        >
          {(data.ventures ?? []).length === 0 ? (
            <div className="blank-inline">No ventures tracked.</div>
          ) : (
            <>
              <div className="home-mrr" title={moneyExact(mrr, currency)}>
                {money(mrr, currency)}
                <span className="dim"> /mo across {data.ventures.length} ventures</span>
              </div>
              <div className="home-next">
                {data.ventures
                  .filter((v) => v.nextAction)
                  .slice(0, 4)
                  .map((v) => (
                    <div key={v.id} className="hn-row">
                      <span className="hn-name">{v.name}</span>
                      <span className="hn-action">{v.nextAction}</span>
                    </div>
                  ))}
              </div>
            </>
          )}
        </Card>
      </div>

      <Card title="Jump to">
        <div className="jump-row">
          {(
            [
              ['todo', 'Todo'],
              ['goals', 'Goals'],
              ['habits', 'Habits'],
              ['business', 'Business'],
              ['finance', 'Finance'],
              ['notes', 'Notes'],
              ['calendar', 'Calendar'],
              ['terminal', 'Claude']
            ] as [PaneKind, string][]
          ).map(([kind, label]) => (
            <button key={kind} className={`jump glyph-${kind}`} onClick={() => openPage(kind)}>
              <Icon name={PAGE_ICONS[kind] ?? 'home'} size={16} />
              {label}
            </button>
          ))}
        </div>
      </Card>
    </Page>
  )
}
