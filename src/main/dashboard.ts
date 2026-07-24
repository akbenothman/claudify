import { app, type BrowserWindow } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, watch, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { Dashboard } from '../shared/types'

/**
 * The dashboard is backed by a plain JSON file rather than a bespoke IPC
 * protocol, because the point is that CLAUDE can change things. A file is an
 * interface every agent already has tools for — no MCP server, no CLI shim. The
 * app watches it and re-renders when it changes on disk.
 */

const INSTRUCTIONS = [
  'This file is the live state of the Claudify "AK Dashboard". Claude may edit it directly.',
  'Edit this file and the dashboard UI updates immediately — no restart needed.',
  'Each top-level section is one page (tab) of the dashboard.',
  'topics[] are the tabs of the todo page; each has its own todos[].',
  'topics[].todos[].status must be one of: todo | doing | blocked | done',
  'notes[] are the tabs of the notes page; body is plain text (newlines allowed).',
  'conversations[].status must be one of: active | waiting | done',
  'goals[] is the goals page. horizon: year | quarter | month | someday.',
  'goals[].progress is 0-100; if a goal has milestones[], progress is computed from them instead.',
  'ventures[] is the business page. stage: idea | building | launched | growing | parked.',
  'ventures[].mrr is a number in the dashboard currency; nextAction is the single next step.',
  'finance.accounts[] are balances (set liability: true for debts, which subtract from net worth).',
  'finance.recurring[] is scheduled money: direction in | out, cadence weekly | monthly | yearly.',
  'finance.transactions[] is the ledger: date YYYY-MM-DD, amount (positive), direction in | out, category.',
  'finance.budgets[] are monthly caps: {category, limit}; spent is summed from this month’s transactions.',
  'finance.goals[] are savings goals: {name, target, saved}; do not confuse with the top-level goals page.',
  'habits[] is the habits page; done[] holds local YYYY-MM-DD dates the habit was completed.',
  'Keep ids stable. Set updated to an ISO-8601 timestamp when you change a row.'
].join(' ')

const EMPTY: Dashboard = {
  _instructions: INSTRUCTIONS,
  topics: [{ id: 'general', name: 'General', todos: [] }],
  notes: [{ id: 'scratch', name: 'Scratch', body: '' }],
  conversations: [],
  goals: [],
  ventures: [],
  finance: { accounts: [], recurring: [], transactions: [], budgets: [], goals: [], currency: '$' },
  habits: []
}

/** Rows an agent wrote by hand are trusted for shape but not for existence. */
const rows = <T extends { id?: string }>(v: unknown): T[] =>
  Array.isArray(v) ? (v as T[]).filter((r) => r && r.id) : []

export function dashboardPath(): string {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return path.join(dir, 'dashboard.json')
}

/** Content we last wrote ourselves, so our own writes don't echo back as changes. */
let lastWritten = ''

export function readDashboard(): Dashboard {
  const file = dashboardPath()
  try {
    const raw = readFileSync(file, 'utf8')
    const parsed = JSON.parse(raw) as Partial<Dashboard>

    const topics = Array.isArray(parsed.topics) ? parsed.topics.filter((t) => t && t.id) : []

    /*
     * A dashboard written before topics existed has a flat `todos` array. Fold
     * it into a topic rather than dropping it on the floor — this file is the
     * user's actual list, and an agent may still write the old shape.
     */
    const legacy = Array.isArray(parsed.todos) ? parsed.todos : []
    if (legacy.length > 0) {
      const general = topics.find((t) => t.id === 'general')
      if (general) {
        const known = new Set(general.todos?.map((t) => t.id))
        general.todos = [...(general.todos ?? []), ...legacy.filter((t) => !known.has(t.id))]
      } else {
        topics.unshift({ id: 'general', name: 'General', todos: legacy })
      }
    }

    const notes = Array.isArray(parsed.notes) ? parsed.notes.filter((n) => n && n.id) : []

    // A file written before a page existed simply has no key for it. Every
    // section defaults to empty rather than undefined, so no page has to guard
    // against a missing array of its own.
    const fin = parsed.finance ?? EMPTY.finance

    return {
      _instructions: INSTRUCTIONS,
      // Never hand back an empty tab strip: a pane with no tabs has nothing to
      // click, and no way back to a usable state.
      topics: topics.length > 0 ? topics.map((t) => ({ ...t, todos: t.todos ?? [] })) : EMPTY.topics,
      notes: notes.length > 0 ? notes.map((n) => ({ ...n, body: n.body ?? '' })) : EMPTY.notes,
      conversations: Array.isArray(parsed.conversations) ? parsed.conversations : [],
      goals: rows<Dashboard['goals'][number]>(parsed.goals).map((g) => ({
        ...g,
        horizon: g.horizon ?? 'quarter',
        progress: Number.isFinite(g.progress) ? g.progress : 0
      })),
      ventures: rows<Dashboard['ventures'][number]>(parsed.ventures).map((v) => ({
        ...v,
        stage: v.stage ?? 'idea'
      })),
      finance: {
        accounts: rows<Dashboard['finance']['accounts'][number]>(fin.accounts).map((a) => ({
          ...a,
          balance: Number.isFinite(a.balance) ? a.balance : 0
        })),
        recurring: rows<Dashboard['finance']['recurring'][number]>(fin.recurring).map((r) => ({
          ...r,
          amount: Number.isFinite(r.amount) ? r.amount : 0,
          cadence: r.cadence ?? 'monthly',
          direction: r.direction ?? 'out'
        })),
        transactions: rows<NonNullable<Dashboard['finance']['transactions']>[number]>(
          fin.transactions
        ).map((t) => ({
          ...t,
          amount: Number.isFinite(t.amount) ? Math.abs(t.amount) : 0,
          direction: t.direction ?? 'out',
          date: typeof t.date === 'string' ? t.date : ''
        })),
        budgets: rows<NonNullable<Dashboard['finance']['budgets']>[number]>(fin.budgets).map((b) => ({
          ...b,
          limit: Number.isFinite(b.limit) ? b.limit : 0
        })),
        goals: rows<NonNullable<Dashboard['finance']['goals']>[number]>(fin.goals).map((g) => ({
          ...g,
          target: Number.isFinite(g.target) ? g.target : 0,
          saved: Number.isFinite(g.saved) ? g.saved : 0
        })),
        savingsTarget: fin.savingsTarget,
        currency: fin.currency ?? '$'
      },
      habits: rows<Dashboard['habits'][number]>(parsed.habits).map((h) => ({
        ...h,
        done: Array.isArray(h.done) ? h.done : []
      }))
    }
  } catch {
    // Missing or malformed (quite likely mid-edit by an agent) — hand back the
    // last good shape rather than throwing into the UI.
    return structuredClone(EMPTY)
  }
}

export function writeDashboard(data: Dashboard): void {
  const file = dashboardPath()
  // `todos` is read-only legacy: fold it in on read, never write it back, or the
  // two copies drift and the pane shows a list nobody edited.
  const { todos: _legacy, ...rest } = data
  const body = JSON.stringify({ ...rest, _instructions: INSTRUCTIONS }, null, 2)
  lastWritten = body
  const tmp = `${file}.tmp`
  writeFileSync(tmp, body, 'utf8')
  renameSync(tmp, file)
}

export function ensureDashboard(): void {
  if (!existsSync(dashboardPath())) writeDashboard(structuredClone(EMPTY))
}

/**
 * Watches the file and notifies the renderer. Debounced, because a single save
 * from an editor typically fires several fs events.
 */
export function watchDashboard(win: BrowserWindow): void {
  ensureDashboard()
  const file = dashboardPath()
  let timer: ReturnType<typeof setTimeout> | undefined

  try {
    watch(path.dirname(file), (_event, filename) => {
      if (filename !== path.basename(file)) return
      clearTimeout(timer)
      timer = setTimeout(() => {
        let raw = ''
        try {
          raw = readFileSync(file, 'utf8')
        } catch {
          return // mid-write; the next event will catch it
        }
        // Don't bounce our own save back into the renderer.
        if (raw === lastWritten) return
        if (!win.isDestroyed()) win.webContents.send('dashboard:changed', readDashboard())
      }, 120)
    })
  } catch {
    // Watching is a nicety; the dashboard still works without live reload.
  }
}
