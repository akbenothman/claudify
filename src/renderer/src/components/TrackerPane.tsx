import { useCallback, useEffect, useState } from 'react'
import type { ConversationInfo } from '../../../shared/types'
import { StatusDot } from './StatusDot'
import { Icon } from './Icon'
import { Blank, Card, Page } from './Page'
import { paneHasSession, projectName, useStore } from '../store'

/**
 * Conversations. Every recent Claude Code session across all your projects,
 * discovered automatically from its transcript on disk — no manual tracking.
 * Each row shows where the thread was left off and whether it's waiting on you.
 *
 * Self-refreshing: it reloads when you return to the window and on a slow
 * interval, so finishing a turn in a pane shows up here without a click.
 *
 * Every row is a door. Click one and you land in the conversation: the pane
 * that's already running it if there is one, or a new pane resuming it if there
 * isn't. A list of threads you can't get back into is just a museum.
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

export function TrackerPane() {
  const [convos, setConvos] = useState<ConversationInfo[] | null>(null)
  const openSession = useStore((s) => s.openSession)
  // Which sessions are live in a pane right now. Subscribing to the workspace
  // tree keeps the "open" badges honest as panes come and go.
  const workspaces = useStore((s) => s.workspaces)

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

  const live = useCallback(
    (sessionId: string) =>
      workspaces.some((w) =>
        w.tabs.some((t) => Object.values(t.panes).some((p) => paneHasSession(p, sessionId)))
      ),
    [workspaces]
  )

  // No confirmation message: both paths put the conversation on screen, and
  // landing in it IS the feedback. A toast left behind on the page you just
  // left would only be read later, when it's already stale.
  const open = (c: ConversationInfo): void =>
    void openSession({ sessionId: c.sessionId, cwd: c.cwd, title: c.title })

  const waiting = convos?.filter((c) => c.pendingToolUse).length ?? 0

  return (
    <Page
      kind="tracker"
      title="Sessions"
      subtitle={
        convos == null
          ? 'loading…'
          : `${convos.length} thread${convos.length === 1 ? '' : 's'}${
              waiting ? ` · ${waiting} waiting on you` : ''
            }`
      }
      actions={
        <button className="ghost" onClick={load}>
          refresh
        </button>
      }
    >
      <Card
        title="Every Claude conversation"
        action={<span className="dim">click a thread to pick it back up</span>}
      >
        <div className="board-list">
          {convos != null && convos.length === 0 && (
            <Blank
              icon="tracker"
              text="No conversations yet"
              hint="Start one in any pane and it shows up here."
            />
          )}
          {convos?.map((c) => {
            const isLive = live(c.sessionId)
            return (
              <button
                key={c.sessionId}
                className={`convo${isLive ? ' convo-live' : ''}`}
                title={`${c.cwd}\n${isLive ? 'Open in a pane — click to jump there' : 'Click to resume this conversation'}`}
                onClick={() => open(c)}
              >
                {/* A thread stuck on a tool is unchecked unless you're already
                    sitting in it — that's what makes the dot amber here. Panes
                    get their "have you looked at this" from the tab you're on;
                    a session on disk has no tab, so it's answered right here. */}
                <StatusDot
                  status={c.pendingToolUse ? 'blocked' : 'finished'}
                  unseen={c.pendingToolUse && !isLive}
                />
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
                <span className="convo-go">
                  {isLive ? 'open' : 'resume'} <Icon name="arrow" size={11} />
                </span>
              </button>
            )
          })}
        </div>
      </Card>
    </Page>
  )
}
