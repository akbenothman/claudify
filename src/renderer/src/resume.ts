import type { Session } from '../../shared/types'

/**
 * Drop the resume bindings we can no longer honour, before the session is
 * restored.
 *
 * A conversation can disappear between two runs of claudify: transcripts get
 * cleaned up, worktrees get deleted, projects get moved. Launching
 * `claude --resume <id>` for one of those is not a loud failure — Claude prints
 * "No conversation found" and exits 0 — so the pane would come back looking
 * like it resumed and be holding nothing. The only reliable moment to check is
 * before we ask, which is here: the main process probes the transcript file and
 * the directory, and anything that fails comes back as a plain shell instead.
 *
 * Every probe runs in parallel and a rejected one is treated as "can't resume",
 * so a slow or unhappy filesystem delays boot by one round trip rather than
 * blocking it.
 */
export async function pruneResume(session: Session): Promise<Session> {
  const bound = session.workspaces.flatMap((w) =>
    w.tabs.flatMap((t) => t.panes.filter((p) => p.resume))
  )
  if (bound.length === 0) return session

  const live = new Set<string>()
  await Promise.all(
    bound.map(async (p) => {
      const r = p.resume
      if (!r) return
      const ok = await window.claudify.canResume(r.cwd, r.sessionId).catch(() => false)
      if (ok) live.add(p.id)
    })
  )

  return {
    ...session,
    workspaces: session.workspaces.map((w) => ({
      ...w,
      tabs: w.tabs.map((t) => ({
        ...t,
        panes: t.panes.map((p) => (p.resume && !live.has(p.id) ? { ...p, resume: undefined } : p))
      }))
    }))
  }
}
