/**
 * Scrollback restore + pane visibility + cmd prompt spacing.
 *
 * Two phases, two processes, because the point is a COLD start:
 *
 *   phase1  wipe state, prove the cmd prompt ends in a space, run a command
 *           with a unique marker, prove only the active tab's panes are
 *           visible, and prove the marker reaches the state file
 *   phase2  boot fresh and prove the marker is back IN THE LIVE TERMINAL —
 *           not merely round-tripped through the file
 *
 *   npm run build && npx electron scripts/smoke-restore.cjs phase1
 *                 && npx electron scripts/smoke-restore.cjs phase2
 */
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const phase = process.argv[process.argv.length - 1]
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const MARKER = 'CLAUDIFY_SCROLLBACK_MARKER_42'
const DIVIDER = 'restored from previous session'

const fail = (msg) => {
  console.error(`RESTORE FAIL (${phase}): ${msg}`)
  app.exit(1)
}

// Own userData dir, shared by both phases. See sandbox.cjs.
const { stateFile } = require('./sandbox.cjs')('restore')
if (phase === 'phase1' && fs.existsSync(stateFile)) fs.rmSync(stateFile)

// Snapshot the file BEFORE the app boots: once the renderer is alive it starts
// saving, and by the time we could ask, it has already written over it.
const onDisk =
  phase === 'phase2' && fs.existsSync(stateFile) ? fs.readFileSync(stateFile, 'utf8') : ''

require('../out/main/index.js')

/** Every terminal pane's saved scrollback, flattened. */
const allScrollback = () => {
  const saved = JSON.parse(fs.readFileSync(stateFile, 'utf8'))
  const out = []
  for (const w of saved.session.workspaces) {
    for (const t of w.tabs) {
      for (const p of t.panes) {
        if (typeof p.scrollback === 'string') out.push(p.scrollback)
      }
    }
  }
  return out
}

app.whenReady().then(async () => {
  const win = BrowserWindow.getAllWindows()[0]
  if (win.webContents.isLoading()) {
    await new Promise((r) => win.webContents.once('did-finish-load', r))
  }
  win.focus()
  await sleep(2500)
  const wc = win.webContents

  if (phase === 'phase1') {
    // --- 1. cmd's prompt must end with a space, so typed text doesn't collide
    //        with the path. Read the raw PTY bytes; don't trust the UI. ---
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

    // cmd paints the prompt with cursor-positioning escapes around it, so strip
    // them before looking at the text.
    // eslint-disable-next-line no-control-regex
    const plain = banner.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '').replace(/\x1b\][^\x07]*\x07/g, '')
    // cmd repositions the cursor instead of emitting a newline before the
    // prompt, so once the escapes are gone the prompt is glued to the banner —
    // match the tail of the line, not the whole line.
    const promptLine = plain.split(/\r?\n/).filter((l) => l.trim()).pop() || ''
    if (!/[A-Za-z]:\\[^>]*>\s$/.test(promptLine)) {
      return fail(
        `cmd prompt has no trailing space. Last line: ${JSON.stringify(promptLine)}`
      )
    }
    console.log(`  cmd prompt ends with a space: ${JSON.stringify(promptLine)} ✓`)

    // --- 2. a workspace of our own (workspace 1 is the permanent dashboard) ---
    await wc.executeJavaScript(`document.querySelector('.ws-new').click(); true`)
    await sleep(2500)

    // --- 3. pane visibility: the dashboard's 4 panes must NOT be painted over
    //        the workspace we're looking at. This is the AK Dashboard bug. ---
    const vis = await wc.executeJavaScript(`(() => {
      const slots = [...document.querySelectorAll('.pane-slot')];
      const shown = slots.filter(s => getComputedStyle(s).visibility !== 'hidden');
      return { total: slots.length, shown: shown.length };
    })()`)
    // The dashboard alone owns 4 panes; the fresh workspace owns exactly 1.
    if (vis.total < 5) return fail(`expected >=5 panes in the DOM, saw ${vis.total}`)
    if (vis.shown !== 1) {
      return fail(
        `only the active tab's pane should be visible, but ${vis.shown} of ${vis.total} are ` +
          `(inactive panes are being painted on top of each other)`
      )
    }
    console.log(`  pane visibility: 1 of ${vis.total} panes visible — inactive tabs hidden ✓`)

    // A new workspace opens Claude (a TUI) on its first tab, which doesn't echo
    // shell output. Add a plain shell tab (new tabs carry no command) to
    // exercise real scrollback capture.
    await wc.executeJavaScript(`document.querySelector('.tab-new').click(); true`)
    await sleep(2500)

    // --- 4. type a marker, let it land in the buffer ---
    // A programmatic .click() doesn't move DOM focus, so put the caret in the
    // visible terminal explicitly before synthesising keystrokes.
    const focused = await wc.executeJavaScript(`(() => {
      const ta = document.querySelector('.pane-slot:not(.hidden) .xterm-helper-textarea');
      if (ta) ta.focus();
      return document.activeElement ? document.activeElement.className : '(none)';
    })()`)
    console.log(`  focus is on: ${JSON.stringify(focused)}`)

    const type = async (text) => {
      for (const ch of text) {
        wc.sendInputEvent({ type: 'char', keyCode: ch })
        await sleep(10)
      }
      wc.sendInputEvent({ type: 'keyDown', keyCode: 'Enter' })
      wc.sendInputEvent({ type: 'char', keyCode: '\r' })
      wc.sendInputEvent({ type: 'keyUp', keyCode: 'Enter' })
    }
    await type(`echo ${MARKER}`)
    await sleep(1500)

    // The periodic sweep (10s) is what captures output, since terminal bytes
    // never touch the store and so never trip the debounced save.
    await sleep(11_000)

    if (!fs.existsSync(stateFile)) return fail('no state file was written')
    const buffers = allScrollback()
    if (!buffers.some((b) => b.includes(MARKER))) {
      buffers.forEach((b, i) => {
        const plainBuf = b.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '').replace(/\s+/g, ' ')
        console.error(`    buffer[${i}] (${b.length} chars): ${JSON.stringify(plainBuf.slice(-160))}`)
      })
      return fail(`marker never reached the saved scrollback (${buffers.length} buffers saved)`)
    }
    console.log(`  marker persisted into scrollback (${buffers.length} terminal buffers saved) ✓`)
    console.log('PHASE1 PASS')
    return app.exit(0)
  }

  // ---- phase2: cold start ----
  // What was on disk when this process started, before the app could save?
  if (!onDisk.includes(MARKER)) {
    return fail('phase1 did not leave the marker on disk — nothing to restore from')
  }
  console.log('  booted from a state file that contains the marker ✓')

  // Wait out one sweep so the app re-saves from its LIVE terminals.
  await sleep(12_000)

  const buffers = allScrollback()
  const live = buffers.find((b) => b.includes(MARKER))
  if (!live) {
    buffers.forEach((b, i) => {
      const plainBuf = b.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '').replace(/\s+/g, ' ')
      console.error(`    buffer[${i}] (${b.length} chars): ${JSON.stringify(plainBuf.slice(-160))}`)
    })
    return fail('marker did not survive the cold start')
  }
  /*
   * The divider is written into xterm at mount, immediately after the replayed
   * history. Its presence in a buffer that was just re-serialized FROM xterm is
   * what proves the history was actually painted into the live terminal, rather
   * than merely copied file-to-file.
   */
  if (!live.includes(DIVIDER)) {
    return fail(
      'scrollback round-tripped through the file but was never replayed into the terminal ' +
        '(no restore divider in the live buffer)'
    )
  }

  const vis = await wc.executeJavaScript(`(() => {
    const slots = [...document.querySelectorAll('.pane-slot')];
    return slots.filter(s => getComputedStyle(s).visibility !== 'hidden').length;
  })()`)
  if (vis !== 1) return fail(`${vis} panes visible after restore, expected 1`)

  console.log('  marker is present in the LIVE xterm buffer after a cold start ✓')
  console.log('  restore divider confirms history was replayed, not just copied ✓')
  console.log('  exactly 1 pane visible after restore ✓')
  console.log('PHASE2 PASS — terminal contents survived a restart')
  app.exit(0)
})
