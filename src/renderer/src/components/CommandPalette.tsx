import { useEffect, useMemo, useRef, useState } from 'react'
import { panesNeedingYou, tabTitle, useStore } from '../store'
import { StatusDot } from './StatusDot'
import { Icon } from './Icon'
import type { PaneStatus } from '../store'

/**
 * "Go to anything" — the Ctrl+K / Ctrl+P palette. It flattens every workspace,
 * tab, and attention-worthy pane into one fuzzy-searchable list, and folds in a
 * handful of global actions (new workspace, worktree split, …). Selecting a
 * navigation item activates that workspace/tab/pane; selecting an action runs it.
 *
 * The heavy lifting is the same navigation the sidebar and tab bar already do —
 * this is just a keyboard-first front door to it.
 */

type Item = {
  id: string
  /** Primary text, matched against the query. */
  label: string
  /** Right-aligned context, e.g. the workspace a tab lives in. Also matched. */
  detail?: string
  kind: 'action' | 'nav'
  status?: PaneStatus
  unseen?: boolean
  hint?: string
  run: () => void
}

/** Cheap subsequence fuzzy match: every query char appears, in order. Scores
 *  contiguous and word-start hits higher so exact-ish matches float up. */
function score(query: string, text: string): number {
  if (!query) return 1
  const q = query.toLowerCase()
  const t = text.toLowerCase()
  let qi = 0
  let s = 0
  let streak = 0
  let prev = -1
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      streak = ti === prev + 1 ? streak + 1 : 0
      s += 1 + streak
      if (ti === 0 || /[\s/:·-]/.test(t[ti - 1])) s += 3 // word boundary
      prev = ti
      qi++
    }
  }
  return qi === q.length ? s : 0
}

export function CommandPalette({
  onClose,
  onSplit,
  onSettings
}: {
  onClose: () => void
  onSplit: () => void
  onSettings: () => void
}) {
  const workspaces = useStore((s) => s.workspaces)
  const [query, setQuery] = useState('')
  const [sel, setSel] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const go = (wsId: string, tabId?: string, paneId?: string): void => {
    const s = useStore.getState()
    s.setActiveWorkspace(wsId)
    if (tabId) s.setActiveTab(wsId, tabId)
    if (tabId && paneId) s.setActivePane(wsId, tabId, paneId)
    onClose()
  }

  const items = useMemo<Item[]>(() => {
    const nav: Item[] = []

    for (const w of workspaces) {
      nav.push({
        id: `ws-${w.id}`,
        label: w.name,
        detail: 'workspace',
        kind: 'nav',
        run: () => go(w.id)
      })
      for (const t of w.tabs) {
        nav.push({
          id: `tab-${t.id}`,
          label: tabTitle(t),
          detail: w.name,
          kind: 'nav',
          run: () => go(w.id, t.id)
        })
      }
    }

    // Panes that want you, surfaced explicitly so you can dive straight in.
    const attention: Item[] = panesNeedingYou(useStore.getState()).map((r) => ({
      id: `pane-${r.paneId}`,
      label: r.pane.title,
      detail: r.pane.branch || 'needs you',
      kind: 'nav',
      status: r.pane.status,
      unseen: r.pane.unseen,
      run: () => go(r.wsId, r.tabId, r.paneId)
    }))

    const cur = () => {
      const s = useStore.getState()
      return s.workspaces.find((w) => w.id === s.activeWorkspaceId)
    }

    const actions: Item[] = [
      {
        id: 'act-new-ws',
        label: 'New workspace',
        detail: 'action',
        kind: 'action',
        hint: 'Ctrl+Shift+N',
        run: () => {
          useStore.getState().newWorkspace()
          onClose()
        }
      },
      {
        id: 'act-new-tab',
        label: 'New tab',
        detail: 'action',
        kind: 'action',
        hint: 'Ctrl+T',
        run: () => {
          const w = cur()
          if (w) useStore.getState().newTab(w.id)
          onClose()
        }
      },
      {
        id: 'act-split',
        label: 'Split into worktrees…',
        detail: 'action',
        kind: 'action',
        hint: 'Ctrl+Shift+S',
        run: () => {
          onClose()
          onSplit()
        }
      },
      {
        id: 'act-browser',
        label: 'New browser tab',
        detail: 'action',
        kind: 'action',
        hint: 'Ctrl+Shift+B',
        run: () => {
          const w = cur()
          if (w) useStore.getState().newBrowserTab(w.id)
          onClose()
        }
      },
      {
        id: 'act-settings',
        label: 'Settings',
        detail: 'action',
        kind: 'action',
        run: () => {
          onClose()
          onSettings()
        }
      }
    ]

    return [...attention, ...nav, ...actions]
  }, [workspaces]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    if (!query.trim()) return items
    return items
      .map((it) => ({ it, s: Math.max(score(query, it.label), score(query, it.detail ?? '') * 0.6) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.it)
  }, [items, query])

  useEffect(() => {
    setSel(0)
  }, [query])

  useEffect(() => {
    const el = listRef.current?.querySelector('.cmd-item.active')
    el?.scrollIntoView({ block: 'nearest' })
  }, [sel])

  const onKeyDown = (e: React.KeyboardEvent): void => {
    e.stopPropagation()
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSel((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSel((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      filtered[sel]?.run()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <div className="modal-backdrop cmd-backdrop" onMouseDown={onClose}>
      <div className="cmd" onMouseDown={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="cmd-input"
          placeholder="Go to a workspace, tab, or agent — or type a command…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <div className="cmd-list" ref={listRef}>
          {filtered.length === 0 && <div className="cmd-empty">No matches</div>}
          {filtered.map((it, i) => (
            <div
              key={it.id}
              className={`cmd-item${i === sel ? ' active' : ''}`}
              onMouseMove={() => setSel(i)}
              onMouseDown={(e) => {
                e.preventDefault()
                it.run()
              }}
            >
              {it.status ? (
                <StatusDot status={it.status} unseen={it.unseen} />
              ) : (
                <span className={`cmd-glyph cmd-${it.kind}`}>
                  <Icon name={it.kind === 'action' ? 'bolt' : 'arrow'} size={13} />
                </span>
              )}
              <span className="cmd-label">{it.label}</span>
              {it.detail && <span className="cmd-detail">{it.detail}</span>}
              {it.hint && <kbd className="cmd-hint">{it.hint}</kbd>}
            </div>
          ))}
        </div>
        <div className="cmd-foot dim">
          <kbd>↑</kbd>
          <kbd>↓</kbd> move <kbd>↵</kbd> open <kbd>esc</kbd> close
        </div>
      </div>
    </div>
  )
}
