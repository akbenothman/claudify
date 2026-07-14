import { app } from 'electron'
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs'
import { writeFile, rename } from 'node:fs/promises'
import path from 'node:path'
import type { AppState, Session, Settings } from '../shared/types'
import { DEFAULT_SHELL_ID } from './shells'

const VERSION = 1

const DEFAULTS: AppState = {
  version: VERSION,
  settings: { shellId: DEFAULT_SHELL_ID, fontSize: 13 },
  session: { workspaces: [], activeWorkspaceId: null }
}

function file(): string {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return path.join(dir, 'claudify-state.json')
}

let cache: AppState | null = null

export function loadState(): AppState {
  if (cache) return cache
  try {
    const raw = readFileSync(file(), 'utf8')
    const parsed = JSON.parse(raw) as AppState
    if (parsed.version !== VERSION) throw new Error('version mismatch')
    cache = {
      version: VERSION,
      settings: { ...DEFAULTS.settings, ...parsed.settings },
      session: parsed.session ?? DEFAULTS.session
    }
  } catch {
    // Missing, corrupt, or from an older schema — start clean rather than
    // half-restoring a session we don't understand.
    cache = structuredClone(DEFAULTS)
  }
  return cache
}

/**
 * Atomic write: a power cut mid-save would otherwise leave a truncated JSON file
 * and lose every workspace — which is the exact failure this feature exists to
 * prevent.
 *
 * Asynchronous, and deliberately not pretty-printed. This runs on the main
 * process, which is also the thread ferrying PTY bytes to the renderer — and the
 * state now carries every terminal's scrollback, so it is hundreds of kilobytes
 * rather than a handful. Stringifying that with indentation and writing it
 * synchronously blocked the event loop for long enough to visibly stall typing.
 */
let writing: Promise<void> = Promise.resolve()
let pending: AppState | null = null

function flush(state: AppState): void {
  // Coalesce: if a write is already in flight, the newest state supersedes any
  // other queued one. There is no value in writing an intermediate snapshot.
  pending = state
  writing = writing.then(async () => {
    const next = pending
    if (!next) return
    pending = null

    const target = file()
    const tmp = `${target}.tmp`
    try {
      await writeFile(tmp, JSON.stringify(next), 'utf8')
      await rename(tmp, target)
    } catch {
      // Losing a save is survivable; crashing the main process is not.
    }
  })
}

/** Blocking variant, for shutdown — the async queue would not survive exit. */
function flushSync(state: AppState): void {
  const target = file()
  const tmp = `${target}.tmp`
  writeFileSync(tmp, JSON.stringify(state), 'utf8')
  renameSync(tmp, target)
}

export function saveSession(session: Session): void {
  const state = loadState()
  state.session = session
  cache = state
  flush(state)
}

/** Called on quit: make sure the last save actually reaches the disk. */
export function saveSessionNow(session: Session): void {
  const state = loadState()
  state.session = session
  cache = state
  pending = null
  flushSync(state)
}

export function saveSettings(settings: Partial<Settings>): Settings {
  const state = loadState()
  state.settings = { ...state.settings, ...settings }
  cache = state
  flush(state)
  return state.settings
}

export function getSettings(): Settings {
  return loadState().settings
}
