import { useState } from 'react'
import type { Goal, GoalHorizon } from '../../../shared/types'
import { Icon } from './Icon'
import { Blank, Card, Meter, Page, Stat } from './Page'
import { newId, nowIso, useDashboard } from '../useDashboard'

/**
 * Goals. Bigger than a todo and slower than a habit: the handful of things the
 * year is actually about, each with a progress bar you can drag and a list of
 * milestones that fills the bar in for you.
 *
 * Grouped by horizon rather than sorted, because "this quarter" and "someday"
 * are different kinds of commitment and mixing them makes both feel optional.
 */

const HORIZONS: { id: GoalHorizon; label: string; blurb: string }[] = [
  { id: 'year', label: 'This year', blurb: 'the big ones' },
  { id: 'quarter', label: 'This quarter', blurb: 'in flight now' },
  { id: 'month', label: 'This month', blurb: 'close enough to touch' },
  { id: 'someday', label: 'Someday', blurb: 'parked, not forgotten' }
]

/** Milestones are the truth when a goal has them; the slider is the fallback. */
function progressOf(g: Goal): number {
  const ms = g.milestones ?? []
  if (ms.length === 0) return g.progress ?? 0
  return Math.round((ms.filter((m) => m.done).length / ms.length) * 100)
}

/** "in 12 days" / "3 days ago" — a due date only matters as a distance. */
function until(iso?: string): { text: string; late: boolean; soon: boolean } | null {
  if (!iso) return null
  const due = new Date(iso)
  if (Number.isNaN(due.getTime())) return null
  const days = Math.round((due.getTime() - Date.now()) / 86_400_000)
  if (days < 0) return { text: `${-days}d overdue`, late: true, soon: false }
  if (days === 0) return { text: 'due today', late: false, soon: true }
  return { text: `${days}d left`, late: false, soon: days <= 14 }
}

export function GoalsPane() {
  const { data, update } = useDashboard()
  const [draft, setDraft] = useState('')
  const [where, setWhere] = useState<GoalHorizon>('quarter')
  const [open, setOpen] = useState<string | null>(null)
  const [msDraft, setMsDraft] = useState('')

  const goals = data?.goals ?? []

  const patch = (id: string, fn: (g: Goal) => Goal) =>
    update((d) => ({ ...d, goals: d.goals.map((g) => (g.id === id ? fn(g) : g)) }))

  const add = () => {
    const title = draft.trim()
    if (!title) return
    setDraft('')
    const g: Goal = { id: newId(), title, horizon: where, progress: 0, updated: nowIso() }
    update((d) => ({ ...d, goals: [...d.goals, g] }))
    setOpen(g.id)
  }

  const remove = (id: string) => update((d) => ({ ...d, goals: d.goals.filter((g) => g.id !== id) }))

  const addMilestone = (g: Goal) => {
    const text = msDraft.trim()
    if (!text) return
    setMsDraft('')
    patch(g.id, (cur) => ({
      ...cur,
      milestones: [...(cur.milestones ?? []), { id: newId(), text, done: false }],
      updated: nowIso()
    }))
  }

  const toggleMilestone = (g: Goal, mid: string) =>
    patch(g.id, (cur) => ({
      ...cur,
      milestones: (cur.milestones ?? []).map((m) => (m.id === mid ? { ...m, done: !m.done } : m)),
      updated: nowIso()
    }))

  const live = goals.filter((g) => g.horizon !== 'someday')
  const avg = live.length ? Math.round(live.reduce((n, g) => n + progressOf(g), 0) / live.length) : 0
  const doneCount = goals.filter((g) => progressOf(g) >= 100).length

  return (
    <Page
      kind="goals"
      title="Goals"
      subtitle={
        goals.length === 0
          ? 'What are you actually working towards?'
          : `${live.length} in flight · ${doneCount} complete`
      }
      actions={
        <div className="page-add">
          <select
            className="select"
            value={where}
            onChange={(e) => setWhere(e.target.value as GoalHorizon)}
          >
            {HORIZONS.map((h) => (
              <option key={h.id} value={h.id}>
                {h.label}
              </option>
            ))}
          </select>
          <input
            value={draft}
            placeholder="New goal…"
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
      {goals.length > 0 && (
        <div className="stat-row">
          <Stat label="Average progress" value={`${avg}%`} tone="accent" hint={<Meter pct={avg} />} />
          <Stat label="Goals in flight" value={live.length} hint="excluding someday" />
          <Stat label="Complete" value={doneCount} tone={doneCount > 0 ? 'up' : undefined} />
        </div>
      )}

      {goals.length === 0 && (
        <Blank
          icon="goals"
          text="No goals yet"
          hint="Add one above — or ask Claude to fill this page in for you."
        />
      )}

      {HORIZONS.map((h) => {
        const list = goals.filter((g) => g.horizon === h.id)
        if (list.length === 0) return null
        return (
          <Card key={h.id} title={h.label} action={<span className="dim">{h.blurb}</span>}>
            <div className="goal-list">
              {list.map((g) => {
                const pct = progressOf(g)
                const due = until(g.due)
                const expanded = open === g.id
                return (
                  <div key={g.id} className={`goal${pct >= 100 ? ' goal-done' : ''}`}>
                    <div className="goal-top" onClick={() => setOpen(expanded ? null : g.id)}>
                      <div className="goal-name">
                        <span className="goal-title">{g.title}</span>
                        {g.detail && <span className="goal-detail">{g.detail}</span>}
                      </div>
                      {due && (
                        <span
                          className={`pill${due.late ? ' pill-late' : due.soon ? ' pill-soon' : ''}`}
                        >
                          {due.text}
                        </span>
                      )}
                      <span className="goal-pct">{pct}%</span>
                      <button
                        className="ghost-x"
                        title="Delete goal"
                        onClick={(e) => {
                          e.stopPropagation()
                          remove(g.id)
                        }}
                      >
                        <Icon name="close" size={11} />
                      </button>
                    </div>

                    <Meter pct={pct} tone={pct >= 100 ? 'up' : undefined} />

                    {expanded && (
                      <div className="goal-open">
                        {/* The slider only drives goals without milestones —
                            otherwise the two would disagree about the same bar. */}
                        {(g.milestones ?? []).length === 0 && (
                          <label className="goal-slider">
                            <span className="dim">Progress</span>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              step={5}
                              value={g.progress ?? 0}
                              onChange={(e) =>
                                patch(g.id, (cur) => ({
                                  ...cur,
                                  progress: Number(e.target.value),
                                  updated: nowIso()
                                }))
                              }
                            />
                          </label>
                        )}

                        <div className="goal-ms">
                          {(g.milestones ?? []).map((m) => (
                            <button
                              key={m.id}
                              className={`ms${m.done ? ' ms-done' : ''}`}
                              onClick={() => toggleMilestone(g, m.id)}
                            >
                              <span className="ms-box">{m.done ? '✓' : ''}</span>
                              {m.text}
                            </button>
                          ))}
                        </div>

                        <div className="inline-add">
                          <input
                            value={expanded ? msDraft : ''}
                            placeholder="Add a milestone…"
                            onChange={(e) => setMsDraft(e.target.value)}
                            onKeyDown={(e) => {
                              e.stopPropagation()
                              if (e.key === 'Enter') addMilestone(g)
                            }}
                          />
                          <input
                            type="date"
                            className="date"
                            value={g.due?.slice(0, 10) ?? ''}
                            title="Target date"
                            onChange={(e) =>
                              patch(g.id, (cur) => ({
                                ...cur,
                                due: e.target.value || undefined,
                                updated: nowIso()
                              }))
                            }
                          />
                          <select
                            className="select"
                            value={g.horizon}
                            onChange={(e) =>
                              patch(g.id, (cur) => ({
                                ...cur,
                                horizon: e.target.value as GoalHorizon,
                                updated: nowIso()
                              }))
                            }
                          >
                            {HORIZONS.map((x) => (
                              <option key={x.id} value={x.id}>
                                {x.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>
        )
      })}
    </Page>
  )
}
