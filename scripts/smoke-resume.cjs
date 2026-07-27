/**
 * Conversation resume across a restart.
 *
 * The claim under test is the strong one: a pane doesn't merely come back in
 * the right directory showing a picture of what it said — it reopens the SAME
 * Claude Code conversation and carries on.
 *
 *   phase1  boot clean, drop a transcript where the dashboard's Claude is
 *           working, and prove the pane captured that session id and saved it
 *   phase2  inject a second pane bound to a conversation that no longer exists,
 *           boot cold, and prove the live one relaunches on `--resume <id>`
 *           while the dead one comes back as a plain shell
 *
 *   npm run build && npx electron scripts/smoke-resume.cjs phase1
 *                 && npx electron scripts/smoke-resume.cjs phase2
 */
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const phase = process.argv[process.argv.length - 1]
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const fail = (msg) => {
  console.error(`RESUME FAIL (${phase}): ${msg}`)
  app.exit(1)
}

const LIVE = '11111111-2222-3333-4444-555555555555'
const GHOST = '99999999-8888-7777-6666-555555555555'

/*
 * A home directory of our own, so the test writes transcripts into a fake
 * ~/.claude instead of the user's real one. transcript.ts reads os.homedir(),
 * which on Windows is USERPROFILE — set it before the app module loads and
 * before the recursive watch is established.
 */
const fakeHome = path.join(os.tmpdir(), 'claudify-smoke-resume-home')
const projects = path.join(fakeHome, '.claude', 'projects')
fs.mkdirSync(projects, { recursive: true })
process.env.USERPROFILE = fakeHome
process.env.HOME = fakeHome

const { stateFile, userData } = require('./sandbox.cjs')('resume')
if (phase === 'phase1' && fs.existsSync(stateFile)) fs.rmSync(stateFile)

/** Claude Code's project-directory encoding (see transcript.ts). */
const encodeCwd = (cwd) => cwd.replace(/[^a-zA-Z0-9]/g, '-')

/**
 * Write a plausible session transcript for `cwd`, dated in the future.
 *
 * The future mtime is load-bearing: the pane binds to the NEWEST transcript in
 * its directory, and the real `claude` this test boots may well write one of
 * its own. Ours has to stay newest for the assertion to mean what it says.
 */
function writeTranscript(cwd, sessionId) {
  const dir = path.join(projects, encodeCwd(cwd))
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `${sessionId}.jsonl`)
  const now = new Date().toISOString()
  fs.writeFileSync(
    file,
    [
      JSON.stringify({ type: 'user', cwd, timestamp: now, message: { role: 'user', content: 'hi' } }),
      JSON.stringify({
        type: 'assistant',
        cwd,
        timestamp: now,
        message: {
          role: 'assistant',
          model: 'claude-opus-4-8',
          content: [{ type: 'text', text: 'hello' }],
          usage: { input_tokens: 10, output_tokens: 5 }
        }
      })
    ].join('\n') + '\n',
    'utf8'
  )
  const soon = new Date(Date.now() + 3600_000)
  fs.utimesSync(file, soon, soon)
  return file
}

const readState = () => JSON.parse(fs.readFileSync(stateFile, 'utf8'))

/** Every pane in the saved session, flattened, with its tab. */
const allPanes = (saved) =>
  saved.session.workspaces.flatMap((w) => w.tabs.flatMap((t) => t.panes.map((p) => ({ p, t, w }))))

/**
 * A terminal buffer with escapes and layout removed. cmd wraps a long command
 * across the 80th column, so the echoed line arrives in the serialized buffer
 * split by a newline — searching for it has to ignore whitespace entirely.
 */
const flatten = (s) =>
  // eslint-disable-next-line no-control-regex
  (s || '').replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '').replace(/\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, '').replace(/\s+/g, '')

/*
 * phase2 setup, before the app can read the file: plant a pane bound to a
 * conversation that was never written, in a tab that was left zoomed. Both are
 * claims only a COLD start can settle, so they have to be on disk first.
 */
if (phase === 'phase2') {
  const seed = readState()
  seed.session.workspaces.push({
    id: 'ws-ghost',
    name: 'ghost',
    cwd: userData,
    activeTabId: 'tab-ghost',
    tabs: [
      {
        id: 'tab-ghost',
        title: 'ghost',
        activePaneId: 'pane-ghost',
        zoomedPaneId: 'pane-ghost',
        layout: {
          kind: 'split',
          id: 'split-ghost',
          dir: 'row',
          ratio: 0.5,
          a: { kind: 'leaf', paneId: 'pane-ghost' },
          b: { kind: 'leaf', paneId: 'pane-ghost-2' }
        },
        panes: [
          {
            id: 'pane-ghost',
            kind: 'terminal',
            title: 'claude: gone',
            cwd: userData,
            resume: { agent: 'claude', sessionId: GHOST, cwd: userData, ts: Date.now() }
          },
          { id: 'pane-ghost-2', kind: 'terminal', title: 'shell', cwd: userData }
        ]
      }
    ]
  })
  fs.writeFileSync(stateFile, JSON.stringify(seed), 'utf8')
}

require('../out/main/index.js')

app.whenReady().then(async () => {
  const win = BrowserWindow.getAllWindows()[0]
  if (win.webContents.isLoading()) {
    await new Promise((r) => win.webContents.once('did-finish-load', r))
  }
  win.focus()
  await sleep(3000)

  if (phase === 'phase1') {
    if (!fs.existsSync(stateFile)) return fail('no state file was written on first boot')

    // The dashboard's Claude: the one pane that is an agent from birth.
    const claudePane = allPanes(readState()).find((x) => x.p.kind === 'terminal' && x.p.persistCommand)
    if (!claudePane) return fail('no dashboard Claude pane in the saved session')

    const file = writeTranscript(claudePane.p.cwd, LIVE)
    console.log(`  wrote transcript ${file}`)

    // The watcher debounces 150ms, the store save 400ms. Give it room.
    await sleep(4000)

    const bound = allPanes(readState()).find((x) => x.p.id === claudePane.p.id)
    if (!bound?.p.resume) {
      return fail(
        `the Claude pane never captured a conversation. Saved pane: ${JSON.stringify(bound?.p && { id: bound.p.id, cwd: bound.p.cwd, resume: bound.p.resume })}`
      )
    }
    if (bound.p.resume.sessionId !== LIVE) {
      return fail(`pane bound to '${bound.p.resume.sessionId}', expected '${LIVE}'`)
    }
    if (bound.p.resume.cwd !== claudePane.p.cwd) {
      return fail(`binding recorded cwd '${bound.p.resume.cwd}', expected '${claudePane.p.cwd}'`)
    }

    // Nobody else may claim the same thread — two Claudes resumed onto one
    // transcript is the failure this guard exists to prevent.
    const claimers = allPanes(readState()).filter((x) => x.p.resume?.sessionId === LIVE)
    if (claimers.length !== 1) {
      return fail(`${claimers.length} panes claimed the same conversation, expected exactly 1`)
    }

    console.log(`  pane ${bound.p.id} captured session ${LIVE} in ${bound.p.resume.cwd} ✓`)
    console.log('  exactly one pane claims the conversation ✓')
    console.log('PHASE1 PASS')
    return app.exit(0)
  }

  // ---- phase2 ----
  const saved = readState()
  const live = allPanes(saved).find((x) => x.p.resume?.sessionId === LIVE)
  if (!live) return fail('phase1 left no bound pane to restore from')

  const zoomed = allPanes(saved).find((x) => x.t.zoomedPaneId)
  if (!zoomed) return fail('the injected zoomed tab did not survive into phase2')

  console.log(`  booted from a session where pane ${live.p.id} holds ${LIVE} ✓`)
  console.log(`  tab '${zoomed.t.title}' came back zoomed on ${zoomed.t.zoomedPaneId} ✓`)

  // One sweep (10s) so every pane's live buffer is re-serialized to disk.
  await sleep(13_000)

  const after = readState()
  const livePane = allPanes(after).find((x) => x.p.id === live.p.id)
  const ghostPane = allPanes(after).find((x) => x.p.id === 'pane-ghost')

  if (!livePane) return fail('the bound pane vanished across the restart')
  if (!ghostPane) return fail('the ghost pane vanished across the restart')

  const liveBuf = flatten(livePane.p.scrollback)
  if (!liveBuf.includes(`--resume${LIVE}`)) {
    return fail(
      `the restored pane never resumed its conversation. Buffer tail: ${JSON.stringify(liveBuf.slice(-200))}`
    )
  }
  console.log(`  restored pane relaunched as claude --resume ${LIVE} ✓`)

  if (!livePane.p.resume || livePane.p.resume.sessionId !== LIVE) {
    return fail('the binding was not carried forward for the NEXT restart')
  }
  console.log('  the binding survives to the next restart too ✓')

  const ghostBuf = flatten(ghostPane.p.scrollback)
  if (ghostBuf.includes('--resume')) {
    return fail(
      `a pane bound to a purged conversation still tried to resume it: ${JSON.stringify(ghostBuf.slice(-200))}`
    )
  }
  if (ghostPane.p.resume) {
    return fail('a dead binding was kept rather than dropped')
  }
  console.log('  a conversation that no longer exists is dropped, not resumed ✓')

  console.log('PHASE2 PASS — the conversation itself survived a restart')
  app.exit(0)
})
