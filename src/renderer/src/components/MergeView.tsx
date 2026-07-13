import { useCallback, useEffect, useState } from 'react'
import type { WorktreeDiff } from '../../../shared/types'
import { useStore, type Workspace } from '../store'

type Row = {
  slug: string
  branch: string
  title: string
  path: string
  diff?: WorktreeDiff
  busy?: boolean
  note?: string
}

export function MergeView({ ws }: { ws: Workspace }) {
  const split = ws.split
  const closeWorkspace = useStore((s) => s.closeWorkspace)
  const [rows, setRows] = useState<Row[]>(
    () => split?.worktrees.map((w) => ({ ...w })) ?? []
  )

  const refresh = useCallback(async () => {
    if (!split) return
    const next = await Promise.all(
      rows.map(async (r) => {
        try {
          const diff = await window.claudify.diff(split.repoRoot, split.baseRef, r.branch)
          return { ...r, diff, note: undefined }
        } catch (e) {
          return { ...r, note: (e as Error).message }
        }
      })
    )
    setRows(next)
    // `rows` identity changes on every edit; refresh reads it fresh each call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [split, rows.length])

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!split) {
    return <div className="merge empty">This workspace was not created by a split.</div>
  }

  const patch = (branch: string, p: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.branch === branch ? { ...r, ...p } : r)))

  /** Agents leave work uncommitted; a diff against base needs a commit first. */
  const commit = async (r: Row) => {
    patch(r.branch, { busy: true, note: undefined })
    try {
      const did = await window.claudify.commitAll(r.path, `claudify: ${r.title}`)
      patch(r.branch, { note: did ? 'committed' : 'nothing to commit' })
    } catch (e) {
      patch(r.branch, { note: (e as Error).message })
    } finally {
      patch(r.branch, { busy: false })
      refresh()
    }
  }

  const merge = async (r: Row) => {
    patch(r.branch, { busy: true, note: undefined })
    const res = await window.claudify.merge(split.repoRoot, split.baseRef, r.branch)
    patch(r.branch, { busy: false, note: res.message })
    refresh()
  }

  const discard = async (r: Row) => {
    patch(r.branch, { busy: true })
    await window.claudify.removeWorktree(split.repoRoot, r.path, r.branch)
    setRows((rs) => rs.filter((x) => x.branch !== r.branch))
  }

  return (
    <div className="merge">
      <div className="merge-head">
        <div>
          <strong>merge</strong>
          <span className="merge-base"> into {split.baseRef}</span>
        </div>
        <div className="merge-actions">
          <button onClick={refresh}>refresh</button>
          <button onClick={() => closeWorkspace(ws.id)} title="Close workspace (worktrees stay)">
            close
          </button>
        </div>
      </div>

      <div className="merge-list">
        {rows.length === 0 && <div className="empty">No worktrees left.</div>}
        {rows.map((r) => (
          <div className="merge-row" key={r.branch}>
            <div className="merge-row-top">
              <span className="merge-title">{r.title}</span>
              <span className="merge-branch">{r.branch}</span>
            </div>

            <div className="merge-stat">
              {!r.diff || r.diff.empty ? (
                <span className="dim">no commits yet — commit the agent's work to diff it</span>
              ) : (
                <span>
                  <span className="add">+{r.diff.insertions}</span>{' '}
                  <span className="del">-{r.diff.deletions}</span>{' '}
                  <span className="dim">across {r.diff.filesChanged} files</span>
                </span>
              )}
            </div>

            {r.diff && !r.diff.empty && <pre className="merge-diff">{r.diff.stat}</pre>}
            {r.note && <div className="merge-note">{r.note}</div>}

            <div className="merge-row-actions">
              <button disabled={r.busy} onClick={() => commit(r)}>
                commit
              </button>
              <button disabled={r.busy || !r.diff || r.diff.empty} onClick={() => merge(r)}>
                merge
              </button>
              <button disabled={r.busy} className="danger" onClick={() => discard(r)}>
                discard
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
