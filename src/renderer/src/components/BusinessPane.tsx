import { useState } from 'react'
import type { Venture, VentureStage } from '../../../shared/types'
import { Icon } from './Icon'
import { Blank, Card, Page, Stat } from './Page'
import { money, moneyExact, newId, nowIso, useDashboard } from '../useDashboard'

/**
 * Business. One card per venture, grouped by stage, each carrying the only two
 * numbers that matter day to day — what it earns, and what the next move is.
 *
 * The "next action" field is deliberately singular. A venture with a backlog is
 * a project; a venture with one next step is something you can actually do
 * today, which is the difference this page is trying to make.
 */

const STAGES: { id: VentureStage; label: string; blurb: string }[] = [
  { id: 'growing', label: 'Growing', blurb: 'earning and climbing' },
  { id: 'launched', label: 'Launched', blurb: 'live, finding its feet' },
  { id: 'building', label: 'Building', blurb: 'not shipped yet' },
  { id: 'idea', label: 'Ideas', blurb: 'unproven' },
  { id: 'parked', label: 'Parked', blurb: 'on ice' }
]

export function BusinessPane() {
  const { data, update } = useDashboard()
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState<string | null>(null)

  const ventures = data?.ventures ?? []
  const currency = data?.finance?.currency ?? '$'

  const patch = (id: string, fn: (v: Venture) => Venture) =>
    update((d) => ({ ...d, ventures: d.ventures.map((v) => (v.id === id ? fn(v) : v)) }))

  const add = () => {
    const name = draft.trim()
    if (!name) return
    setDraft('')
    const v: Venture = { id: newId(), name, stage: 'idea', updated: nowIso() }
    update((d) => ({ ...d, ventures: [...d.ventures, v] }))
    setEditing(v.id)
  }

  const remove = (id: string) =>
    update((d) => ({ ...d, ventures: d.ventures.filter((v) => v.id !== id) }))

  const mrr = ventures.reduce((n, v) => n + (v.mrr ?? 0), 0)
  const earning = ventures.filter((v) => (v.mrr ?? 0) > 0).length
  const active = ventures.filter((v) => v.stage !== 'parked' && v.stage !== 'idea').length

  return (
    <Page
      kind="business"
      title="Business"
      subtitle={
        ventures.length === 0
          ? 'Every venture, and the one next step each needs'
          : `${ventures.length} ventures · ${active} active`
      }
      actions={
        <div className="page-add">
          <input
            value={draft}
            placeholder="New venture…"
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
      {ventures.length > 0 && (
        <div className="stat-row">
          <Stat
            label="Total MRR"
            value={<span title={moneyExact(mrr, currency)}>{money(mrr, currency)}</span>}
            tone={mrr > 0 ? 'up' : undefined}
            hint={`${money(mrr * 12, currency)} a year at this rate`}
          />
          <Stat label="Earning" value={earning} hint={`of ${ventures.length} ventures`} />
          <Stat label="Active" value={active} hint="building, launched or growing" />
        </div>
      )}

      {ventures.length === 0 && (
        <Blank
          icon="business"
          text="No ventures yet"
          hint="Add one above, then set its stage, revenue and next action."
        />
      )}

      {STAGES.map((s) => {
        const list = ventures.filter((v) => v.stage === s.id)
        if (list.length === 0) return null
        return (
          <Card key={s.id} title={s.label} action={<span className="dim">{s.blurb}</span>}>
            <div className="venture-list">
              {list.map((v) => (
                <div key={v.id} className={`venture stage-${v.stage}`}>
                  <div className="venture-top">
                    <span className="venture-name">{v.name}</span>
                    {(v.mrr ?? 0) > 0 && (
                      <span className="venture-mrr" title={moneyExact(v.mrr ?? 0, currency)}>
                        {money(v.mrr ?? 0, currency)}/mo
                      </span>
                    )}
                    <span className="spacer" />
                    <button
                      className="ghost"
                      onClick={() => setEditing(editing === v.id ? null : v.id)}
                    >
                      {editing === v.id ? 'done' : 'edit'}
                    </button>
                    <button className="ghost-x" title="Delete" onClick={() => remove(v.id)}>
                      <Icon name="close" size={11} />
                    </button>
                  </div>

                  {v.pitch && <div className="venture-pitch">{v.pitch}</div>}

                  {v.nextAction && (
                    <div className="venture-next">
                      <Icon name="arrow" size={12} />
                      <span>{v.nextAction}</span>
                    </div>
                  )}

                  {editing === v.id && (
                    <div className="venture-edit">
                      <input
                        defaultValue={v.pitch ?? ''}
                        placeholder="What is it, in one line?"
                        onKeyDown={(e) => e.stopPropagation()}
                        onBlur={(e) =>
                          patch(v.id, (cur) => ({
                            ...cur,
                            pitch: e.target.value.trim() || undefined,
                            updated: nowIso()
                          }))
                        }
                      />
                      <input
                        defaultValue={v.nextAction ?? ''}
                        placeholder="The single next step…"
                        onKeyDown={(e) => e.stopPropagation()}
                        onBlur={(e) =>
                          patch(v.id, (cur) => ({
                            ...cur,
                            nextAction: e.target.value.trim() || undefined,
                            updated: nowIso()
                          }))
                        }
                      />
                      <div className="venture-fields">
                        <select
                          className="select"
                          value={v.stage}
                          onChange={(e) =>
                            patch(v.id, (cur) => ({
                              ...cur,
                              stage: e.target.value as VentureStage,
                              updated: nowIso()
                            }))
                          }
                        >
                          {STAGES.map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.label}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          className="num"
                          defaultValue={v.mrr ?? ''}
                          placeholder="MRR"
                          onKeyDown={(e) => e.stopPropagation()}
                          onBlur={(e) =>
                            patch(v.id, (cur) => ({
                              ...cur,
                              mrr: e.target.value === '' ? undefined : Number(e.target.value),
                              updated: nowIso()
                            }))
                          }
                        />
                        <input
                          defaultValue={v.url ?? ''}
                          placeholder="https://"
                          onKeyDown={(e) => e.stopPropagation()}
                          onBlur={(e) =>
                            patch(v.id, (cur) => ({
                              ...cur,
                              url: e.target.value.trim() || undefined,
                              updated: nowIso()
                            }))
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )
      })}
    </Page>
  )
}
