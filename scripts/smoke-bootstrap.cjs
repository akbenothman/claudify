/**
 * Worktree bootstrap smoke test.
 *
 * A fresh `git worktree add` has none of the gitignored scaffolding a build
 * depends on. claudify seeds each new worktree — junctioning dependency dirs
 * and copying env files — so an agent can actually build. We assert that a
 * worktree comes up with node_modules reachable and .env present.
 *
 *   npm run build && npx electron scripts/smoke-bootstrap.cjs
 */
const { app, BrowserWindow } = require('electron')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

require('./sandbox.cjs')('bootstrap')
require('../out/main/index.js')

const fail = (msg) => {
  console.error(`BOOTSTRAP FAIL: ${msg}`)
  app.exit(1)
}

function makeRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claudify-bs-'))
  const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'pipe' })
  git('init', '-b', 'main')
  git('config', 'user.email', 'smoke@claudify.test')
  git('config', 'user.name', 'Claudify Smoke')
  fs.writeFileSync(path.join(root, 'README.md'), '# base\n')
  // Gitignored scaffolding a fresh worktree wouldn't otherwise get.
  fs.writeFileSync(path.join(root, '.gitignore'), 'node_modules/\n.env\n')
  fs.mkdirSync(path.join(root, 'node_modules', 'left-pad'), { recursive: true })
  fs.writeFileSync(path.join(root, 'node_modules', 'left-pad', 'index.js'), 'module.exports=1\n')
  fs.writeFileSync(path.join(root, '.env'), 'SECRET=42\n')
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
  setTimeout(() => fail('timed out after 40s'), 40_000)

  const repo = makeRepo()
  const tasks = [{ slug: 'alpha', branch: 'claudify/alpha', title: 'alpha', prompt: 'do alpha' }]

  const wt = await win.webContents.executeJavaScript(
    `window.claudify.createWorktrees(${JSON.stringify(repo)}, 'main', ${JSON.stringify(tasks)})`
  )
  const wtPath = wt[0].path

  // node_modules is junctioned, so a nested file is reachable through it.
  const dep = path.join(wtPath, 'node_modules', 'left-pad', 'index.js')
  if (!fs.existsSync(dep)) return fail(`node_modules not seeded into the worktree: ${dep}`)
  console.log('  node_modules reachable in the worktree (junction) ✓')

  // .env is copied (a real file, not a link — each worktree gets its own).
  const env = path.join(wtPath, '.env')
  if (!fs.existsSync(env)) return fail(`.env not copied into the worktree: ${env}`)
  if (fs.readFileSync(env, 'utf8').trim() !== 'SECRET=42') return fail('.env content did not copy')
  console.log('  .env copied into the worktree ✓')

  console.log('BOOTSTRAP PASS')
  app.exit(0)
})
