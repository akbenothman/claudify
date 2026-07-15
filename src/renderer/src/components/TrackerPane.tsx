import { useCallback, useEffect, useState } from 'react'
import type { ConversationInfo } from '../../../shared/types'
import { StatusDot } from './StatusDot'

/**
 * Conversations. Every recent Claude Code session across all your projects,
 * discovered automatically from its transcript on disk — no manual tracking.
 * Each row shows where the thread was left off and whether it's waiting on you.
 *
 * Read-only and self-refreshing: it reloads when you return to the window and on
 * a slow interval, so finishing a turn in a pane shows up here without a click.
 */

/** Relative time from an epoch, so a row shows at a glance how stale it is. */
function ago(ms: number): string {
  if (!ms) return ''
  const diff = Date.now() - ms
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const projectName = (cwd: string): string =>
  cwd.split(/[\\/]/).filter(Boolean).pop() || cwd || '—'

export function TrackerPane() {
  const [convos, setConvos] = useState<ConversationInfo[] | null>(null)

  const load = useCallback(() => {
    window.claudify.listConversations().then(setConvos)
  }, [])

  useEffect(() => {
    load()
    const onFocus = (): void => load()
    window.addEventListener('focus', onFocus)
    const iv = setInterval(load, 30_000)
    return () => {
      window.removeEventListener('focus', onFocus)
      clearInterval(iv)
    }
  }, [load])

  const waiting = convos?.filter((c) => c.pendingToolUse).length ?? 0

  return (
    <div className="board convos">
      <div className="board-head">
        <strong>conversations</strong>
        <span className="dim">
          {convos == null
            ? 'loading…'
            : `${convos.length} thread${convos.length === 1 ? '' : 's'}${
                waiting ? ` · ${waiting} waiting` : ''
              }`}
        </span>
      </div>

      <div className="board-list">
        {convos != null && convos.length === 0 && (
          <div className="board-empty">
            No Claude conversations yet. Start one in any pane and it shows up here.
          </div>
        )}
        {convos?.map((c) => (
          <div key={c.sessionId} className="convo" title={c.cwd}>
            <StatusDot status={c.pendingToolUse ? 'blocked' : 'finished'} />
            <div className="convo-text">
              <div className="convo-title">{c.title}</div>
              <div className="convo-sub">{c.leftOff}</div>
              <div className="convo-meta dim">
                <span className="convo-proj">{projectName(c.cwd)}</span>
                <span>·</span>
                <span>{ago(c.updated)}</span>
                {c.messages > 0 && (
                  <>
                    <span>·</span>
                    <span>
                      {c.messages} turn{c.messages === 1 ? '' : 's'}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
