import { spawn } from 'node:child_process'
import { BRANCH_PREFIX, getRepoInfo, slugify } from './git'
import type { SplitPlan, SplitTask } from '../shared/types'

const MAX_TASKS = 6
const PLANNER_TIMEOUT_MS = 90_000

const PLANNER_PROMPT = `You are a task decomposer for a git-worktree-parallel coding tool.

Split the user's request into INDEPENDENT tasks that can be worked on in parallel
in separate git worktrees, by separate coding agents, without conflicting.

Rules:
- Tasks must not touch the same files. If two pieces of work would collide, keep them as ONE task.
- If the request is genuinely a single unit of work, return exactly one task. Do not invent busywork.
- Maximum ${MAX_TASKS} tasks.
- "prompt" must be a complete, self-contained instruction. The agent receiving it sees ONLY that
  prompt and the repo, not the original request or the other tasks.

Respond with a raw JSON array and NOTHING else — no prose, no markdown fences:
[{"slug":"kebab-case-id","title":"short label","prompt":"full self-contained instruction"}]

The user's request follows.
`

/** Pulls the first balanced top-level JSON array out of a model response. */
function extractJsonArray(text: string): unknown {
  const start = text.indexOf('[')
  if (start === -1) return null
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (inStr) {
      if (esc) esc = false
      else if (c === '\\') esc = true
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') inStr = true
    else if (c === '[') depth++
    else if (c === ']') {
      depth--
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1))
        } catch {
          return null
        }
      }
    }
  }
  return null
}

/**
 * Runs the planner Claude.
 *
 * The user's request goes over stdin, never argv — on Windows `claude` is a
 * `.cmd` shim which Node can only launch via a shell, and putting arbitrary
 * user text on a cmd.exe command line is a command-injection hazard.
 */
function runPlanner(request: string, cwd: string): Promise<SplitTask[] | null> {
  return new Promise((resolve) => {
    let child
    try {
      child = spawn('claude', ['-p', '--output-format', 'json'], {
        cwd,
        shell: true,
        windowsHide: true
      })
    } catch {
      return resolve(null)
    }

    let stdout = ''
    let settled = false
    const finish = (result: SplitTask[] | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try {
        child.kill()
      } catch {
        /* already exited */
      }
      resolve(result)
    }

    const timer = setTimeout(() => finish(null), PLANNER_TIMEOUT_MS)

    child.stdout.on('data', (d) => {
      stdout += d.toString()
    })
    child.on('error', () => finish(null))

    child.on('close', () => {
      // `--output-format json` wraps the reply as { result: "..." }; if that
      // envelope is missing (older CLI, or an error), fall back to raw stdout.
      let body = stdout
      try {
        const env = JSON.parse(stdout) as { result?: string }
        if (typeof env.result === 'string') body = env.result
      } catch {
        /* not the JSON envelope; treat stdout as the reply */
      }

      const parsed = extractJsonArray(body)
      if (!Array.isArray(parsed) || parsed.length === 0) return finish(null)

      const tasks: SplitTask[] = []
      for (const raw of parsed.slice(0, MAX_TASKS)) {
        const t = raw as Partial<SplitTask>
        if (!t || typeof t.prompt !== 'string' || !t.prompt.trim()) continue
        const title = (typeof t.title === 'string' && t.title.trim()) || t.prompt.slice(0, 60)
        const slug = slugify(typeof t.slug === 'string' && t.slug ? t.slug : title)
        tasks.push({ slug, branch: `${BRANCH_PREFIX}${slug}`, title, prompt: t.prompt.trim() })
      }
      finish(tasks.length ? tasks : null)
    })

    child.stdin.write(`${PLANNER_PROMPT}\n${request}\n`)
    child.stdin.end()
  })
}

/**
 * Last-resort split used when the `claude` CLI is missing or the planner fails.
 * Treats newlines / semicolons as task separators so the feature still works
 * when the user has already enumerated the tasks themselves.
 */
function heuristicSplit(request: string): SplitTask[] {
  const parts = request
    .split(/\n+|;+/)
    .map((s) => s.replace(/^\s*[-*\d.)\]]+\s*/, '').trim())
    .filter(Boolean)

  const chosen = parts.length > 1 ? parts.slice(0, MAX_TASKS) : [request.trim()]
  const seen = new Set<string>()

  return chosen.map((prompt) => {
    let slug = slugify(prompt)
    while (seen.has(slug)) slug = `${slug}-x`
    seen.add(slug)
    return {
      slug,
      branch: `${BRANCH_PREFIX}${slug}`,
      title: prompt.length > 60 ? `${prompt.slice(0, 57)}...` : prompt,
      prompt
    }
  })
}

/** Produces the plan. Never throws for a planner failure — it degrades instead. */
export async function planSplit(cwd: string, request: string): Promise<SplitPlan> {
  const info = await getRepoInfo(cwd)
  if (!info.isRepo) {
    throw new Error(`${cwd} is not a git repository. Worktree splitting needs one.`)
  }

  const tasks = await runPlanner(request, info.root)
  return {
    repoRoot: info.root,
    baseRef: info.branch,
    tasks: tasks ?? heuristicSplit(request),
    degraded: tasks === null
  }
}
