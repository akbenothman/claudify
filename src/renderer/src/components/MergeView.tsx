import { useCallback, useEffect, useState } from 'react'
import type { CheckResult, ConflictPair, WorktreeDiff } from '../../../shared/types'
import { useStore, type Workspace } from '../store'
import { buildPatch, parseDiff, type FileDiff } from '../diff'

type Row = {
  slug: string
  branch: string
  title: string
  path: string
  diff?: WorktreeDiff
  check?: CheckResult
  busy?: boolean
  note?: string
  adopting?: boolean
}

export function MergeView({ ws }: { ws: Workspace }) {
  const split = ws.split
  const closeWorkspace = useStore((s) => s.closeWorkspace)
  const [rows, setRows] = useState<Row[]>(() => split?.worktrees.map((w) => ({ ...w })) ?? [])
  const [conflicts, setConflicts] = useState<ConflictPair[]>([])

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
    // Pre-flight: which branches with real commits would collide with each other.
    const branches = next.filter((r) => r.diff && !r.diff.empty).map((r) => r.branch)
    if (branches.length > 1) {
      window.claudify.previewConflicts(split.repoRoot, branches).then(setConflicts).catch(() => {})
    } else {
      setConflicts([])
    }
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

  const check = async (r: Row) => {
    patch(r.branch, { busy: true, note: 'running tests…' })
    try {
      const res = await window.claudify.checkWorktree(split.repoRoot, r.path)
      patch(r.branch, { check: res, note: undefined })
    } catch (e) {
      patch(r.branch, { note: (e as Error).message })
    } finally {
      patch(r.branch, { busy: false })
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

  const badge = (c: CheckResult) =>
    !c.ran ? (
      <span className="check-badge dim" title={c.output}>
        no tests
      </span>
    ) : c.ok ? (
      <span className="check-badge pass" title={c.output}>
        ✓ tests pass
      </span>
    ) : (
      <span className="check-badge fail" title={c.output}>
        ✗ tests fail
      </span>
    )

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

      {conflicts.length > 0 && (
        <div className="merge-conflicts">
          <strong>heads up — these branches overlap:</strong>
          {conflicts.map((c) => (
            <div key={`${c.a}|${c.b}`} className="merge-conflict-row">
              <span>
                {c.a.replace('claudify/', '')} ✕ {c.b.replace('claudify/', '')}
              </span>
              <span className="dim">
                {c.files.length ? c.files.join(', ') : 'conflicting changes'}
              </span>
            </div>
          ))}
          <div className="dim">Merge the one you trust first, then resolve the other by hunk.</div>
        </div>
      )}

      <div className="merge-list">
        {rows.length === 0 && <div className="empty">No worktrees left.</div>}
        {rows.map((r) => (
          <div className="merge-row" key={r.branch}>
            <div className="merge-row-top">
              <span className="merge-title">{r.title}</span>
              <span className="merge-branch">{r.branch}</span>
              {r.check && badge(r.check)}
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
              <button disabled={r.busy} onClick={() => check(r)}>
                run tests
              </button>
              <button
                disabled={r.busy || !r.diff || r.diff.empty}
                onClick={() => patch(r.branch, { adopting: !r.adopting })}
              >
                {r.adopting ? 'hide hunks' : 'adopt hunks'}
              </button>
              <button disabled={r.busy || !r.diff || r.diff.empty} onClick={() => merge(r)}>
                merge
              </button>
              <button disabled={r.busy} className="danger" onClick={() => discard(r)}>
                discard
              </button>
            </div>

            {r.adopting && r.diff && !r.diff.empty && (
              <AdoptPanel
                repoRoot={split.repoRoot}
                baseRef={split.baseRef}
                branch={r.branch}
                onDone={(msg) => patch(r.branch, { note: msg })}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Adopt individual hunks from a branch into the base working tree. You take the
 * parts you want and leave the rest — dark-mode's CSS without the config change
 * it bundled in.
 */
function AdoptPanel({
  repoRoot,
  baseRef,
  branch,
  onDone
}: {
  repoRoot: string
  baseRef: string
  branch: string
  onDone: (msg: string) => void
}) {
  const [files, setFiles] = useState<FileDiff[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let live = true
    window.claudify
      .patch(repoRoot, baseRef, branch)
      .then((p) => live && setFiles(parseDiff(p).filter((f) => !f.binary && f.hunks.length > 0)))
      .catch(() => live && setFiles([]))
    return () => {
      live = false
    }
  }, [repoRoot, baseRef, branch])

  const toggle = (key: string) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const apply = async () => {
    if (!files) return
    const p = buildPatch(files, selected)
    if (!p) return onDone('select at least one hunk')
    setBusy(true)
    const res = await window.claudify.applyPatch(repoRoot, p)
    setBusy(false)
    onDone(res.message)
  }

  if (!files) return <div className="adopt dim">loading diff…</div>
  if (files.length === 0) return <div className="adopt dim">no text hunks to adopt.</div>

  return (
    <div className="adopt">
      {files.map((f, fi) => (
        <div key={fi} className="adopt-file">
          <div className="adopt-path">{f.path}</div>
          {f.hunks.map((h, hi) => {
            const key = `${fi}:${hi}`
            return (
              <label key={hi} className="adopt-hunk">
                <input type="checkbox" checked={selected.has(key)} onChange={() => toggle(key)} />
                <span className="adopt-hunk-head">{h.header}</span>
                <span className="dim">
                  {' '}
                  <span className="add">+{h.added}</span> <span className="del">-{h.removed}</span>
                </span>
              </label>
            )
          })}
        </div>
      ))}
      <div className="adopt-actions">
        <button disabled={busy || selected.size === 0} onClick={apply}>
          apply {selected.size} hunk{selected.size === 1 ? '' : 's'} to {baseRef}
        </button>
      </div>
    </div>
  )
}
