/**
 * End-to-end smoke test for the git worktree engine.
 *
 * Builds a throwaway repo, then drives the real IPC surface from the renderer:
 * create worktrees -> simulate an agent editing files in one -> commit it ->
 * diff it against base -> merge it back. Asserts the change lands on main.
 *
 * The planner (`claude -p`) is deliberately not exercised here; this is about
 * the git plumbing that has to be correct or you lose work.
 *
 *   npm run build && npx electron scripts/smoke-worktree.cjs
 */
const { app, BrowserWindow } = require('electron')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

// Booting the app starts session persistence; keep it off the user's real
// session file. See sandbox.cjs.
require('./sandbox.cjs')('worktree')

require('../out/main/index.js')

const fail = (msg) => {
  console.error(`WORKTREE FAIL: ${msg}`)
  app.exit(1)
}

function makeRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claudify-wt-'))
  const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'pipe' })
  git('init', '-b', 'main')
  git('config', 'user.email', 'smoke@claudify.test')
  git('config', 'user.name', 'Claudify Smoke')
  fs.writeFileSync(path.join(root, 'README.md'), '# base\n')
  git('add', '-A')
  git('commit', '-m', 'base')
  return root
}

app.whenReady().then(async () => {
  const win = BrowserWindow.getAllWindows()[0]
  if (!win) return fail('no BrowserWindow')
  if (win.webContents.isLoading()) {
    await new Promise((r) => win.webContents.once('did-finish-load', r))
  }
  setTimeout(() => fail('timed out after 60s'), 60_000)

  const repo = makeRepo()
  const tasks = [
    { slug: 'alpha', branch: 'claudify/alpha', title: 'alpha task', prompt: 'do alpha' },
    { slug: 'beta', branch: 'claudify/beta', title: 'beta task', prompt: 'do beta' }
  ]

  const script = `(async () => {
    const repo = ${JSON.stringify(repo)};
    const tasks = ${JSON.stringify(tasks)};
    const c = window.claudify;

    const info = await c.gitInfo(repo);
    if (!info.isRepo) return { ok: false, why: 'gitInfo says not a repo' };
    if (info.branch !== 'main') return { ok: false, why: 'unexpected base branch: ' + info.branch };

    const wts = await c.createWorktrees(info.root, info.branch, tasks);
    if (wts.length !== 2) return { ok: false, why: 'expected 2 worktrees, got ' + wts.length };

    // Worktrees must be listed back, and must be real isolated checkouts.
    const listed = await c.listWorktrees(info.root);
    if (listed.length !== 2) return { ok: false, why: 'listWorktrees returned ' + listed.length };

    return { ok: true, info, wts };
  })()`

  let res
  try {
    res = await win.webContents.executeJavaScript(script)
  } catch (e) {
    return fail(`renderer threw: ${e.message}`)
  }
  if (!res.ok) return fail(res.why)

  const { info, wts } = res
  const alpha = wts.find((w) => w.slug === 'alpha')

  // Both worktrees must exist on disk as independent checkouts.
  for (const w of wts) {
    if (!fs.existsSync(path.join(w.path, 'README.md'))) {
      return fail(`worktree ${w.slug} is not a real checkout at ${w.path}`)
    }
  }

  // Simulate the agent in the alpha pane doing work.
  fs.writeFileSync(path.join(alpha.path, 'alpha.txt'), 'alpha did work\n')
  fs.appendFileSync(path.join(alpha.path, 'README.md'), 'alpha was here\n')

  const script2 = `(async () => {
    const c = window.claudify;
    const repo = ${JSON.stringify(info.root)};
    const base = ${JSON.stringify(info.branch)};
    const alpha = ${JSON.stringify(alpha)};

    const before = await c.diff(repo, base, alpha.branch);
    if (!before.empty) return { ok: false, why: 'diff should be empty before commit' };

    const did = await c.commitAll(alpha.path, 'agent work');
    if (!did) return { ok: false, why: 'commitAll found nothing to commit' };

    const after = await c.diff(repo, base, alpha.branch);
    if (after.empty) return { ok: false, why: 'diff still empty after commit' };
    if (after.filesChanged !== 2) return { ok: false, why: 'expected 2 files changed, got ' + after.filesChanged };

    const merged = await c.merge(repo, base, alpha.branch);
    if (!merged.ok) return { ok: false, why: 'merge failed: ' + merged.message };

    return { ok: true, stat: after.stat, insertions: after.insertions, msg: merged.message };
  })()`

  let res2
  try {
    res2 = await win.webContents.executeJavaScript(script2)
  } catch (e) {
    return fail(`renderer threw: ${e.message}`)
  }
  if (!res2.ok) return fail(res2.why)

  // The merged work must now be on main in the primary checkout.
  const landed = fs.existsSync(path.join(info.root, 'alpha.txt'))
  if (!landed) return fail('merge reported success but alpha.txt is not on main')

  console.log('WORKTREE PASS')
  console.log(`  created 2 isolated worktrees (${wts.map((w) => w.branch).join(', ')})`)
  console.log(`  committed + diffed alpha: +${res2.insertions} across 2 files`)
  console.log(`  ${res2.msg}`)
  console.log('  alpha.txt is present on main ✓')
  app.exit(0)
})
