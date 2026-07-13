import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import type { RepoInfo, SplitTask, Worktree, WorktreeDiff } from '../shared/types'

const exec = promisify(execFile)

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
 * Creates one worktree per task, each on its own branch cut from `baseRef`.
 * Every task gets a real, isolated checkout, so the Claudes cannot collide on
 * the same files.
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

/** Commits everything in a worktree, so a task's work is diffable/mergeable. */
export async function commitAll(wtPath: string, message: string): Promise<boolean> {
  const status = await git(wtPath, ['status', '--porcelain'])
  if (!status) return false
  await git(wtPath, ['add', '-A'])
  await git(wtPath, ['commit', '-m', message])
  return true
}

export { BRANCH_PREFIX }
