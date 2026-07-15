/**
 * Control-surface smoke test.
 *
 * The claim: an agent can drive the terminal by editing control.json — no MCP,
 * no shim — and claudify acts on it and writes the result back. We write a
 * couple of requests from OUTSIDE the app (as an agent's Write tool would) and
 * assert both the visible effect and the result recorded in the file.
 *
 *   npm run build && npx electron scripts/smoke-control.cjs
 */
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const { stateFile, userData } = require('./sandbox.cjs')('control')
const controlFile = path.join(userData, 'control.json')
if (fs.existsSync(stateFile)) fs.rmSync(stateFile)
if (fs.existsSync(controlFile)) fs.rmSync(controlFile)

require('../out/main/index.js')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fail = (msg) => {
  console.error(`CONTROL FAIL: ${msg}`)
  app.exit(1)
}

app.whenReady().then(async () => {
  const win = BrowserWindow.getAllWindows()[0]
  if (win.webContents.isLoading()) {
    await new Promise((r) => win.webContents.once('did-finish-load', r))
  }
  win.focus()
  await sleep(3000)
  const js = (src) => win.webContents.executeJavaScript(src)

  // A plain shell to target — its status is nobody's but the control surface's.
  // A new workspace opens Claude on its first tab, so split off a shell pane
  // (splits carry no initial command) rather than target the agent.
  await js(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'N', ctrlKey: true, shiftKey: true }))`)
  await sleep(1200)
  await js(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', ctrlKey: true, shiftKey: true }))`)
  await sleep(1500)

  // Write two requests the way an agent would.
  fs.writeFileSync(
    controlFile,
    JSON.stringify({
      requests: [
        { id: 'r1', action: 'notify', title: 'Build done', body: 'tests are green' },
        { id: 'r2', action: 'status', match: 'shell', state: 'blocked' }
      ]
    }),
    'utf8'
  )
  await sleep(1500) // no reload — the app watches control.json itself

  // The status request should have lit the shell pane's "needs you" marker.
  const blocked = await js(
    `[...document.querySelectorAll('.pane-blocked')].map(e => e.textContent).join('|')`
  )
  if (!/needs you/.test(blocked)) {
    return fail(`status request did not mark a pane blocked: ${JSON.stringify(blocked)}`)
  }
  console.log('  status request lit a pane blocked ✓')

  // Both requests should be recorded done, with a result, back in the file.
  const onDisk = JSON.parse(fs.readFileSync(controlFile, 'utf8'))
  const r1 = onDisk.requests.find((r) => r.id === 'r1')
  const r2 = onDisk.requests.find((r) => r.id === 'r2')
  if (r1?.status !== 'done') return fail(`notify request not resolved: ${JSON.stringify(r1)}`)
  if (r2?.status !== 'done') return fail(`status request not resolved: ${JSON.stringify(r2)}`)
  console.log(`  results written back to control.json: r1=${r1.result} · r2=${r2.result} ✓`)

  // A request that matches nothing is resolved as an error, not silently dropped.
  fs.writeFileSync(
    controlFile,
    JSON.stringify({
      requests: [...onDisk.requests, { id: 'r3', action: 'status', match: 'nope-xyz', state: 'idle' }]
    }),
    'utf8'
  )
  await sleep(1200)
  const after = JSON.parse(fs.readFileSync(controlFile, 'utf8'))
  const r3 = after.requests.find((r) => r.id === 'r3')
  if (r3?.status !== 'error') return fail(`unmatched request should error: ${JSON.stringify(r3)}`)
  console.log(`  unmatched request errored cleanly: ${r3.result} ✓`)

  console.log('CONTROL PASS')
  app.exit(0)
})
