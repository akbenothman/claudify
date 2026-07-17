import { useEffect, useState } from 'react'
import { Icon } from './Icon'
import type { SplitPlan } from '../../../shared/types'
import { useStore } from '../store'

type Phase = 'compose' | 'planning' | 'review' | 'launching'

export function SplitDialog({ onClose }: { onClose: () => void }) {
  const defaultCwd = useStore((s) => s.defaultCwd)
  const createSplitWorkspace = useStore((s) => s.createSplitWorkspace)

  const [repo, setRepo] = useState(defaultCwd)
  const [request, setRequest] = useState('')
  const [phase, setPhase] = useState<Phase>('compose')
  const [plan, setPlan] = useState<SplitPlan | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => setRepo(defaultCwd), [defaultCwd])

  const pick = async () => {
    const p = await window.claudify.pickFolder()
    if (p) setRepo(p)
  }

  const doPlan = async () => {
    setError(null)
    setPhase('planning')
    try {
      const p = await window.claudify.planSplit(repo, request)
      setPlan(p)
      setPhase('review')
    } catch (e) {
      setError((e as Error).message.replace(/^Error invoking remote method .*?: /, ''))
      setPhase('compose')
    }
  }

  const launch = async () => {
    if (!plan) return
    setPhase('launching')
    try {
      const worktrees = await window.claudify.createWorktrees(plan.repoRoot, plan.baseRef, plan.tasks)
      createSplitWorkspace(plan, worktrees)
      onClose()
    } catch (e) {
      setError((e as Error).message.replace(/^Error invoking remote method .*?: /, ''))
      setPhase('review')
    }
  }

  const editTask = (i: number, prompt: string) => {
    if (!plan) return
    const tasks = plan.tasks.map((t, n) => (n === i ? { ...t, prompt } : t))
    setPlan({ ...plan, tasks })
  }

  const dropTask = (i: number) => {
    if (!plan) return
    setPlan({ ...plan, tasks: plan.tasks.filter((_, n) => n !== i) })
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <strong>Split into worktrees</strong>
          <button className="pane-x" onClick={onClose}>
            <Icon name="close" size={11} />
          </button>
        </div>

        {(phase === 'compose' || phase === 'planning') && (
          <>
            <label>Repository</label>
            <div className="row">
              <input value={repo} onChange={(e) => setRepo(e.target.value)} spellCheck={false} />
              <button onClick={pick}>browse</button>
            </div>

            <label>What do you want done?</label>
            <textarea
              autoFocus
              rows={6}
              placeholder={'add dark mode\nfix the auth token refresh bug\nwrite tests for the parser'}
              value={request}
              onChange={(e) => setRequest(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && request.trim()) doPlan()
              }}
            />
            <div className="hint">
              Claude decomposes this into independent tasks, one git worktree and one agent each.
              Ctrl+Enter to plan.
            </div>

            {error && <div className="error">{error}</div>}

            <div className="modal-actions">
              <button onClick={onClose}>cancel</button>
              <button
                className="primary"
                disabled={!request.trim() || phase === 'planning'}
                onClick={doPlan}
              >
                {phase === 'planning' ? 'planning…' : 'plan'}
              </button>
            </div>
          </>
        )}

        {(phase === 'review' || phase === 'launching') && plan && (
          <>
            <div className="hint">
              {plan.tasks.length} task{plan.tasks.length === 1 ? '' : 's'} branching from{' '}
              <code>{plan.baseRef}</code>. Each gets its own worktree and its own Claude.
            </div>

            {plan.degraded && (
              <div className="warn">
                The planner Claude wasn&apos;t reachable, so this is a literal line-by-line split.
                Check the tasks below before launching.
              </div>
            )}

            <div className="plan-list">
              {plan.tasks.map((t, i) => (
                <div className="plan-task" key={t.slug + i}>
                  <div className="plan-task-head">
                    <span className="plan-branch">{t.branch}</span>
                    <button className="pane-x" onClick={() => dropTask(i)} title="Drop this task">
                      <Icon name="close" size={11} />
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    value={t.prompt}
                    onChange={(e) => editTask(i, e.target.value)}
                  />
                </div>
              ))}
            </div>

            {error && <div className="error">{error}</div>}

            <div className="modal-actions">
              <button onClick={() => setPhase('compose')}>back</button>
              <button
                className="primary"
                disabled={plan.tasks.length === 0 || phase === 'launching'}
                onClick={launch}
              >
                {phase === 'launching'
                  ? 'creating worktrees…'
                  : `launch ${plan.tasks.length} agent${plan.tasks.length === 1 ? '' : 's'}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
