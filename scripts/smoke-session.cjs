/**
 * Session persistence + shell selection + status indicator smoke test.
 *
 * Runs in two phases, as two separate Electron processes, because the thing we
 * actually care about is a COLD start reading the session back off disk.
 *
 *   phase1  wipe state, rename a workspace, add a tab, verify the shell is cmd,
 *           verify the working/finished dot lights up while a command runs
 *   phase2  boot fresh and assert the workspaces came back
 *
 *   npm run build && npx electron scripts/smoke-session.cjs phase1
 *                 && npx electron scripts/smoke-session.cjs phase2
 */
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const phase = process.argv[process.argv.length - 1]
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const fail = (msg) => {
  console.error(`SESSION FAIL (${phase}): ${msg}`)
  app.exit(1)
}

// Own userData dir, shared by both phases — phase2's whole job is to read back
// what phase1 saved. Under the app's real profile this wiped the user's session.
const { stateFile } = require('./sandbox.cjs')('session')

// Wipe any previous state BEFORE the app module loads it into its cache.
if (phase === 'phase1' && fs.existsSync(stateFile)) fs.rmSync(stateFile)

require('../out/main/index.js')

app.whenReady().then(async () => {
  const win = BrowserWindow.getAllWindows()[0]
  if (win.webContents.isLoading()) {
    await new Promise((r) => win.webContents.once('did-finish-load', r))
  }
  win.focus()
  await sleep(2500)
  const wc = win.webContents

  if (phase === 'phase1') {
    // --- the configured shell must be cmd.exe, not PowerShell ---
    const shell = await wc.executeJavaScript(`(async () => {
      const settings = await window.claudify.getSettings();
      const shells = await window.claudify.detectShells();
      return { shellId: settings.shellId, available: shells.map(s => s.id) };
    })()`)
    if (shell.shellId !== 'cmd') return fail(`default shell is '${shell.shellId}', expected 'cmd'`)
    console.log(`  shell default = ${shell.shellId}; detected = [${shell.available.join(', ')}]`)

    // Prove the spawned PTY really is cmd: its banner says so.
    const banner = await wc.executeJavaScript(`(async () => {
      const ports = new Map(); const waiters = new Map();
      window.addEventListener('message', (e) => {
        if (e.source !== window) return;
        const d = e.data;
        if (!d || d.tag !== 'claudify:pty-port' || !d.id) return;
        const w = waiters.get(d.id);
        if (w) { waiters.delete(d.id); w(e.ports[0]); } else { ports.set(d.id, e.ports[0]); }
      });
      const id = await window.claudify.createTerminal({ cwd: 'C:\\\\', cols: 80, rows: 24 });
      const port = ports.get(id) || await new Promise((res) => waiters.set(id, res));
      let buf = '';
      port.onmessage = (e) => { if (typeof e.data === 'string') buf += e.data; };
      port.start();
      await new Promise((r) => setTimeout(r, 2500));
      await window.claudify.killTerminal(id);
      return buf;
    })()`)
    if (!/Microsoft Windows/i.test(banner)) {
      return fail(`spawned shell doesn't look like cmd.exe. Got: ${JSON.stringify(banner.slice(0, 160))}`)
    }
    console.log('  spawned PTY banner confirms cmd.exe ✓')

    // Work in a fresh workspace — workspace 1 is the permanent AK Dashboard.
    await wc.executeJavaScript(`document.querySelector('.ws-new').click(); true`)
    await sleep(2500)

    // --- status indicator: run something slow, watch the dot ---
    const type = async (text) => {
      for (const ch of text) {
        wc.sendInputEvent({ type: 'char', keyCode: ch })
        await sleep(10)
      }
      wc.sendInputEvent({ type: 'keyDown', keyCode: 'Enter' })
      wc.sendInputEvent({ type: 'char', keyCode: '\r' })
      wc.sendInputEvent({ type: 'keyUp', keyCode: 'Enter' })
    }
    const dots = () =>
      wc.executeJavaScript(
        `[...document.querySelectorAll('.pane-slot:not(.hidden) .pane-head .dot')].map(d => d.className)`
      )

    await type('ping -n 4 127.0.0.1')
    await sleep(900)
    const during = await dots()
    await sleep(4500)
    const after = await dots()

    if (!during.some((c) => c.includes('dot-working'))) {
      return fail(`expected a 'working' dot while pinging, got ${JSON.stringify(during)}`)
    }
    if (after.some((c) => c.includes('dot-working'))) {
      return fail(`dot still 'working' after the command finished: ${JSON.stringify(after)}`)
    }
    console.log(`  status dot: ${during[0]} while running -> ${after[0]} when done ✓`)

    // --- mutate the session through the real UI, then let it persist ---
    // Right-click OUR workspace (the last row — the first is the dashboard).
    await wc.executeJavaScript(`(() => {
      const rows = [...document.querySelectorAll('.ws')];
      rows[rows.length - 1].dispatchEvent(
        new MouseEvent('contextmenu', { bubbles: true, clientX: 60, clientY: 160 })
      );
      return true;
    })()`)
    await sleep(300)
    await wc.executeJavaScript(`(() => {
      [...document.querySelectorAll('.menu-item')].find(e => e.textContent === 'Rename').click();
      return true;
    })()`)
    await sleep(300)
    await wc.executeJavaScript(`(() => {
      const i = document.querySelector('.ws .rename');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(i, 'persisted-ws');
      i.dispatchEvent(new Event('input', { bubbles: true }));
      i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      return true;
    })()`)
    await sleep(300)
    // Add a second tab.
    await wc.executeJavaScript(`document.querySelector('.tab-new').click(); true`)
    await sleep(1500) // clear the 400ms save debounce

    if (!fs.existsSync(stateFile)) return fail('no state file was written')
    const saved = JSON.parse(fs.readFileSync(stateFile, 'utf8'))
    const w = saved.session.workspaces.find((x) => x.name === 'persisted-ws')
    if (!w) {
      return fail(`renamed workspace not in saved file: ${JSON.stringify(saved.session.workspaces.map((x) => x.name))}`)
    }
    if (w.tabs.length !== 2) return fail(`saved ${w.tabs.length} tabs, expected 2`)
    // The dashboard must persist too, and stay permanent.
    const dash = saved.session.workspaces.find((x) => x.permanent)
    if (!dash) return fail('the permanent dashboard workspace was not persisted')
    console.log(`  wrote ${stateFile}`)
    console.log(`  saved workspace '${w.name}' with ${w.tabs.length} tabs ✓`)
    console.log('PHASE1 PASS')
    return app.exit(0)
  }

  // ---- phase2: cold start. Did it come back? ----
  const restored = await wc.executeJavaScript(`(() => {
    const ws = [...document.querySelectorAll('.ws .ws-name')].map(e => e.textContent.replace('★',''));
    const tabs = document.querySelectorAll('.tabbar .tab').length;
    const xterms = document.querySelectorAll('.pane-slot:not(.hidden) .xterm').length;
    const dashboards = document.querySelectorAll('.ws .ws-pin').length;
    return { ws, tabs, xterms, dashboards };
  })()`)

  if (!restored.ws.includes('persisted-ws')) {
    return fail(`workspace not restored. Sidebar shows ${JSON.stringify(restored.ws)}`)
  }
  if (restored.tabs !== 2) return fail(`restored ${restored.tabs} tabs, expected 2`)
  if (restored.xterms < 1) return fail('restored workspace has no live terminal')
  // Exactly one dashboard: ensureDashboard() must not add a second on restore.
  if (restored.dashboards !== 1) {
    return fail(`expected exactly 1 permanent dashboard after restore, found ${restored.dashboards}`)
  }

  console.log(`  sidebar: ${JSON.stringify(restored.ws)}`)
  console.log(`  ${restored.tabs} tabs restored, ${restored.xterms} live terminal(s) respawned ✓`)
  console.log('  exactly one AK Dashboard (not duplicated on restore) ✓')
  console.log('PHASE2 PASS — session survived a cold start')
  app.exit(0)
})
