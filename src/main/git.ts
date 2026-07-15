import { exec as execCb, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { copyFile, mkdir, rm, symlink } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type {
  CheckResult,
  ConflictPair,
  RepoInfo,
  SplitTask,
  Worktree,
  WorktreeDiff
} from '../shared/types'

const exec = promisify(execFile)
const shell = promisify(execCb)

const BRANCH_PREFIX = 'claudify/'

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await exec('git', args, {
    cwd,
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024
  })
  return stdout.trim()
}

export function slugify(input: string): string {
  const s = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return s || 'task'
}

export async function getRepoInfo(cwd: string): Promise<RepoInfo> {
  try {
    const root = await git(cwd, ['rev-parse', '--show-toplevel'])
    const branch = await git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'])
    return { root: path.normalize(root), branch, isRepo: true }
  } catch {
    return { root: cwd, branch: '', isRepo: false }
  }
}

/**
 * Worktrees live in a sibling directory rather than inside the repo. Nesting
 * them under the repo root makes them show up in `git status` and in every
 * ripgrep/build glob, which is exactly the noise we're trying to avoid.
 */
export function worktreeDir(repoRoot: string): string {
  return path.join(path.dirname(repoRoot), '.claudify-worktrees', path.basename(repoRoot))
}

/** True when the working tree has staged or unstaged changes. */
export async function isDirty(repoRoot: string): Promise<boolean> {
  const out = await git(repoRoot, ['status', '--porcelain'])
  return out.length > 0
}

async function branchExists(repoRoot: string, branch: string): Promise<boolean> {
  try {
    await git(repoRoot, ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`])
    return true
  } catch {
    return false
  }
}

/**
 * What a fresh worktree needs seeded so it can actually build. A `git worktree
 * add` gives you a clean checkout with none of the gitignored scaffolding a
 * build depends on — no `node_modules`, no `.env` — so half the time an agent's
 * first act is a five-minute install or a build that can't run at all.
 */
interface WorktreeSeed {
  /** Directories junctioned/symlinked from the repo (e.g. `node_modules`). */
  link: string[]
  /** Files copied from the repo (e.g. `.env`). */
  copy: string[]
  /** Commands run in the new worktree after seeding (e.g. `prisma generate`). */
  run: string[]
}

/**
 * Reads `<repo>/claudify.worktree.json` if present; otherwise auto-detects the
 * usual suspects. Auto mode links dependency directories that exist and copies
 * common env files — no config needed for the common case.
 */
function readSeed(repoRoot: string): WorktreeSeed {
  try {
    const raw = readFileSync(path.join(repoRoot, 'claudify.worktree.json'), 'utf8')
    const p = JSON.parse(raw) as Partial<WorktreeSeed>
    return {
      link: Array.isArray(p.link) ? p.link : [],
      copy: Array.isArray(p.copy) ? p.copy : [],
      run: Array.isArray(p.run) ? p.run : []
    }
  } catch {
    const link = ['node_modules', '.venv', 'vendor'].filter((d) =>
      existsSync(path.join(repoRoot, d))
    )
    const copy = ['.env', '.env.local', '.env.development.local'].filter((f) =>
      existsSync(path.join(repoRoot, f))
    )
    return { link, copy, run: [] }
  }
}

/**
 * Seeds one worktree. Linking is a directory junction on Windows (no admin
 * needed) so `node_modules` is shared instantly rather than copied — the single
 * biggest reason worktree fan-out feels bad on real repos. Best-effort: a seed
 * step that fails must never fail the whole split.
 */
async function seedWorktree(repoRoot: string, wtPath: string): Promise<void> {
  const seed = readSeed(repoRoot)

  for (const rel of seed.link) {
    const src = path.join(repoRoot, rel)
    const dst = path.join(wtPath, rel)
    if (!existsSync(src) || existsSync(dst)) continue
    try {
      await mkdir(path.dirname(dst), { recursive: true })
      await symlink(src, dst, process.platform === 'win32' ? 'junction' : 'dir')
    } catch {
      /* fall through — a missing node_modules just means the agent installs it */
    }
  }

  for (const rel of seed.copy) {
    const src = path.join(repoRoot, rel)
    const dst = path.join(wtPath, rel)
    if (!existsSync(src) || existsSync(dst)) continue
    try {
      await copyFile(src, dst)
    } catch {
      /* best effort */
    }
  }

  for (const cmd of seed.run) {
    try {
      await shell(cmd, { cwd: wtPath, windowsHide: true, timeout: 300_000 })
    } catch {
      /* a failed hook is the agent's problem to notice, not ours to crash on */
    }
  }
}

/**
 * Creates one worktree per task, each on its own branch cut from `baseRef`.
 * Every task gets a real, isolated checkout, so the Claudes cannot collide on
 * the same files — and each is seeded (see `seedWorktree`) so it can build.
 */
export async function createWorktrees(
  repoRoot: string,
  baseRef: string,
  tasks: SplitTask[]
): Promise<Worktree[]> {
  const base = worktreeDir(repoRoot)
  await mkdir(base, { recursive: true })

  const created: Worktree[] = []
  for (const task of tasks) {
    // Collisions with a previous split are common (same slug, re-run). Suffix
    // until we find a free branch rather than failing the whole split.
    let branch = task.branch
    let slug = task.slug
    let n = 2
    while (await branchExists(repoRoot, branch)) {
      slug = `${task.slug}-${n}`
      branch = `${BRANCH_PREFIX}${slug}`
      n++
    }

    const wtPath = path.join(base, slug)
    await rm(wtPath, { recursive: true, force: true })
    await git(repoRoot, ['worktree', 'add', '-b', branch, wtPath, baseRef])
    await seedWorktree(repoRoot, wtPath)

    created.push({ slug, branch, title: task.title, path: wtPath })
  }
  return created
}

export async function listWorktrees(repoRoot: string): Promise<Worktree[]> {
  const out = await git(repoRoot, ['worktree', 'list', '--porcelain'])
  const trees: Worktree[] = []
  let cur: { path?: string; branch?: string } = {}

  const flush = () => {
    if (cur.path && cur.branch?.startsWith(BRANCH_PREFIX)) {
      const slug = cur.branch.slice(BRANCH_PREFIX.length)
      trees.push({ slug, branch: cur.branch, title: slug, path: cur.path })
    }
    cur = {}
  }

  for (const line of out.split('\n')) {
    if (line.startsWith('worktree ')) {
      flush()
      cur.path = line.slice('worktree '.length).trim()
    } else if (line.startsWith('branch ')) {
      cur.branch = line.slice('branch '.length).trim().replace('refs/heads/', '')
    }
  }
  flush()
  return trees
}

export async function diffForBranch(
  repoRoot: string,
  baseRef: string,
  branch: string
): Promise<WorktreeDiff> {
  // `base...branch` (three dots) diffs against the merge-base, so unrelated
  // commits landing on base afterwards don't pollute the task's diff.
  const stat = await git(repoRoot, ['diff', '--stat', `${baseRef}...${branch}`])
  const shortstat = await git(repoRoot, ['diff', '--shortstat', `${baseRef}...${branch}`])

  const num = (re: RegExp): number => {
    const m = shortstat.match(re)
    return m ? parseInt(m[1], 10) : 0
  }

  return {
    branch,
    stat,
    filesChanged: num(/(\d+) files? changed/),
    insertions: num(/(\d+) insertions?/),
    deletions: num(/(\d+) deletions?/),
    empty: shortstat.length === 0
  }
}

/** Full patch text for the merge view. */
export async function patchForBranch(
  repoRoot: string,
  baseRef: string,
  branch: string
): Promise<string> {
  return git(repoRoot, ['diff', `${baseRef}...${branch}`])
}

/**
 * Merges a task branch back into `baseRef`. Refuses on a dirty tree and
 * surfaces conflicts as an error rather than leaving the repo mid-merge.
 */
export async function mergeBranch(
  repoRoot: string,
  baseRef: string,
  branch: string
): Promise<{ ok: boolean; message: string }> {
  if (await isDirty(repoRoot)) {
    return { ok: false, message: 'Main working tree has uncommitted changes. Commit or stash first.' }
  }
  const current = await git(repoRoot, ['rev-parse', '--abbrev-ref', 'HEAD'])
  if (current !== baseRef) {
    return { ok: false, message: `Repo is on '${current}', expected '${baseRef}'. Switch branches first.` }
  }
  try {
    await git(repoRoot, ['merge', '--no-ff', '-m', `claudify: merge ${branch}`, branch])
    return { ok: true, message: `Merged ${branch} into ${baseRef}.` }
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message: string }
    const detail = (err.stdout || '') + (err.stderr || '') || err.message
    if (/conflict/i.test(detail)) {
      // Leave the repo clean; the user can re-merge deliberately.
      await git(repoRoot, ['merge', '--abort']).catch(() => {})
      return { ok: false, message: `Merge conflicts in ${branch}. Aborted; resolve manually.` }
    }
    return { ok: false, message: detail.trim() }
  }
}

/** Removes the worktree checkout, and optionally the branch with it. */
export async function removeWorktree(
  repoRoot: string,
  wtPath: string,
  branch?: string
): Promise<void> {
  await git(repoRoot, ['worktree', 'remove', '--force', wtPath]).catch(async () => {
    await rm(wtPath, { recursive: true, force: true })
    await git(repoRoot, ['worktree', 'prune'])
  })
  if (branch) {
    await git(repoRoot, ['branch', '-D', branch]).catch(() => {})
  }
}

/* --------------------------- verify / conflicts --------------------------- */

const tail = (s: string, n = 2000): string => (s.length > n ? `…${s.slice(-n)}` : s)

/** The command that proves a worktree's work: config `check`, else `npm test`. */
function checkCommand(repoRoot: string): string | null {
  try {
    const p = JSON.parse(readFileSync(path.join(repoRoot, 'claudify.worktree.json'), 'utf8'))
    if (typeof p.check === 'string' && p.check.trim()) return p.check
  } catch {
    /* no config */
  }
  try {
    const pkg = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'))
    if (pkg.scripts?.test) return 'npm test'
  } catch {
    /* not a node repo */
  }
  return null
}

/**
 * Runs the check command inside a worktree so the merge view can badge it green
 * or red — you merge evidence, not vibes. Node deps are junctioned in, so a
 * plain `npm test` works in a fresh worktree.
 */
export async function runCheck(repoRoot: string, wtPath: string): Promise<CheckResult> {
  const cmd = checkCommand(repoRoot)
  if (!cmd) return { ran: false, ok: false, cmd: '', output: 'No test command (set "check" in claudify.worktree.json).' }
  try {
    const { stdout, stderr } = await shell(cmd, {
      cwd: wtPath,
      windowsHide: true,
      timeout: 600_000,
      maxBuffer: 16 * 1024 * 1024
    })
    return { ran: true, ok: true, cmd, output: tail(stdout + stderr) }
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message: string }
    return { ran: true, ok: false, cmd, output: tail((err.stdout || '') + (err.stderr || '') || err.message) }
  }
}

/** Conflicted files reported by `git merge-tree --name-only` after the tree oid. */
function parseMergeTreeConflicts(stdout: string): string[] {
  const lines = stdout.split('\n')
  const files: string[] = []
  // Line 0 is the (partial) tree oid; conflicted paths follow until a blank line
  // or an informational block.
  for (let i = 1; i < lines.length; i++) {
    const l = lines[i].trim()
    if (!l) break
    files.push(l)
  }
  return files
}

/**
 * Dry-runs a real 3-way merge for every pair of task branches and reports which
 * pairs collide. The planner only *claims* the tasks don't overlap — this
 * verifies it, so you learn that dark-mode and auth-fix both touch the config
 * before you merge, not during.
 */
export async function previewConflicts(
  repoRoot: string,
  branches: string[]
): Promise<ConflictPair[]> {
  const pairs: ConflictPair[] = []
  for (let i = 0; i < branches.length; i++) {
    for (let j = i + 1; j < branches.length; j++) {
      const a = branches[i]
      const b = branches[j]
      try {
        // Exit 0 → clean merge. `merge-tree` finds the merge base itself.
        await git(repoRoot, ['merge-tree', '--write-tree', '--name-only', a, b])
      } catch (e) {
        const err = e as { code?: number; stdout?: string }
        // merge-tree exits 1 on conflict and lists the conflicted files.
        pairs.push({ a, b, files: parseMergeTreeConflicts(err.stdout || '') })
      }
    }
  }
  return pairs
}

/**
 * Applies a patch (a subset of a branch's hunks) to the base working tree,
 * leaving the changes unstaged for review. This is how you take dark-mode's CSS
 * without the config tweak it snuck in — adoption by hunk, not whole-branch.
 */
export function applyPatch(repoRoot: string, patch: string): Promise<{ ok: boolean; message: string }> {
  return new Promise((resolve) => {
    const child = execFile(
      'git',
      ['apply', '--3way', '--whitespace=nowarn', '-'],
      { cwd: repoRoot, windowsHide: true, maxBuffer: 32 * 1024 * 1024 },
      (err, _stdout, stderr) => {
        if (err) resolve({ ok: false, message: (stderr || (err as Error).message).trim() })
        else resolve({ ok: true, message: 'Applied to the working tree (unstaged).' })
      }
    )
    child.stdin?.end(patch)
  })
}

/** Commits everything in a worktree, so a task's work is diffable/mergeable. */
export async function commitAll(wtPath: string, message: string): Promise<boolean> {
  const status = await git(wtPath, ['status', '--porcelain'])
  if (!status) return false
  await git(wtPath, ['add', '-A'])
  await git(wtPath, ['commit', '-m', message])
  return true
}

export { BRANCH_PREFIX }
