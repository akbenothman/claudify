/**
 * Pane drag-out, post-merge splitting, cwd inheritance, and Shift+Enter.
 *
 * PTY SURVIVAL is the load-bearing assertion again: a pane that moves between
 * tabs must not be remounted, or the terminal (and any agent in it) dies. We
 * stamp the DOM node and check the stamp is still there afterwards.
 *
 *   npm run build && npx electron scripts/smoke-panes.cjs
 */
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

// Own userData dir — never the user's real session. See sandbox.cjs.
const { stateFile } = require('./sandbox.cjs')('panes')
if (fs.existsSync(stateFile)) fs.rmSync(stateFile)

require('../out/main/index.js')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fail = (msg) => {
  console.error(`PANES FAIL: ${msg}`)
  app.exit(1)
}

const readSession = () => JSON.parse(fs.readFileSync(stateFile, 'utf8')).session

app.whenReady().then(async () => {
  const win = BrowserWindow.getAllWindows()[0]
  if (win.webContents.isLoading()) {
    await new Promise((r) => win.webContents.once('did-finish-load', r))
  }
  win.focus()
  await sleep(2500)
  const wc = win.webContents
  const js = (src) => wc.executeJavaScript(src)

  // Workspace 1 is the permanent dashboard; work in one of our own.
  await js(`document.querySelector('.ws-new').click(); true`)
  await sleep(2000)

  const before = await js(`(() => ({
    workspaces: [...document.querySelectorAll('.ws .ws-name')].map(e => e.textContent),
    active: document.querySelector('.status-ws')?.textContent,
    visiblePanes: document.querySelectorAll('.pane-slot:not(.hidden) .pane').length
  }))()`)
  console.log(`  workspaces: ${JSON.stringify(before.workspaces)}; active: ${before.active}; panes: ${before.visiblePanes}`)

  /* ------------------- 1. split, then drag a pane back out ------------------ */

  // Release the modifiers too: a keyDown with no keyUp leaves Ctrl/Shift stuck
  // down, and everything typed afterwards arrives as control codes.
  const chord = (keyCode) => {
    wc.sendInputEvent({ type: 'keyDown', keyCode, modifiers: ['control', 'shift'] })
    wc.sendInputEvent({ type: 'keyUp', keyCode, modifiers: ['control', 'shift'] })
  }

  chord('D')
  await sleep(2000)

  let panes = await js(`document.querySelectorAll('.pane-slot:not(.hidden) .pane').length`)
  if (panes !== 2) {
    return fail(
      `expected 2 panes after split, got ${panes} (active workspace was ${before.active}, ` +
        `${before.visiblePanes} pane(s) before the split)`
    )
  }

  // Stamp the pane we're about to drag: a remount would lose this.
  await js(`(() => {
    const p = [...document.querySelectorAll('.pane-slot:not(.hidden) .pane')][1];
    p.querySelector('.term-host').__survived = 'yes';
    p.querySelector('.term-host').dataset.stamp = 'B';
    return true;
  })()`)

  const popped = await js(`(async () => {
    const p = [...document.querySelectorAll('.pane-slot:not(.hidden) .pane')][1];
    const payload = { wsId: p.dataset.wsId, tabId: p.dataset.tabId, paneId: p.dataset.paneId };
    const tabsBefore = document.querySelectorAll('.tabbar .tab').length;

    const dt = new DataTransfer();
    dt.setData('application/x-claudify-pane', JSON.stringify(payload));
    const bar = document.querySelector('.tabbar');
    const box = bar.getBoundingClientRect();
    bar.dispatchEvent(new DragEvent('drop', {
      bubbles: true, cancelable: true, dataTransfer: dt,
      clientX: box.right - 20, clientY: box.top + box.height / 2
    }));
    await new Promise(r => setTimeout(r, 800));

    const stamped = document.querySelector('.term-host[data-stamp="B"]');
    return {
      tabsBefore,
      tabsAfter: document.querySelectorAll('.tabbar .tab').length,
      visiblePanes: document.querySelectorAll('.pane-slot:not(.hidden) .pane').length,
      nodeStillThere: !!stamped,
      ptySurvived: stamped ? stamped.__survived === 'yes' : false
    };
  })()`)

  if (popped.tabsAfter !== popped.tabsBefore + 1) {
    return fail(
      `dragging a pane to the tab bar should add a tab: ${popped.tabsBefore} before, ${popped.tabsAfter} after`
    )
  }
  if (popped.visiblePanes !== 1) {
    return fail(`the popped-out tab should show exactly its 1 pane, saw ${popped.visiblePanes}`)
  }
  if (!popped.nodeStillThere) return fail('the terminal DOM node vanished when the pane was popped out')
  if (!popped.ptySurvived) {
    return fail('pane was REMOUNTED when dragged out — its PTY (and any agent) would have been killed')
  }
  console.log(`  dragged a pane to the tab bar -> its own tab (${popped.tabsAfter} tabs) ✓`)
  console.log('  terminal DOM node survived the pop-out → PTY intact ✓')

  /* ---------- 2. drop it back onto a pane, then split the merged pane ------- */

  const remerged = await js(`(async () => {
    const tabs = [...document.querySelectorAll('.tabbar .tab')];
    const src = tabs[tabs.length - 1];           // the tab we just popped out
    const srcTabId = src.dataset.tabId;
    const srcPane = document.querySelector('.pane-slot .pane[data-tab-id="' + srcTabId + '"]');
    const payload = {
      wsId: srcPane.dataset.wsId, tabId: srcTabId, paneId: srcPane.dataset.paneId
    };

    // Switch to the other tab and drop the pane onto its pane.
    tabs[tabs.length - 2].click();
    await new Promise(r => setTimeout(r, 500));

    const target = document.querySelector('.pane-slot:not(.hidden) .pane');
    const box = target.getBoundingClientRect();
    const dt = new DataTransfer();
    dt.setData('application/x-claudify-pane', JSON.stringify(payload));
    target.dispatchEvent(new DragEvent('drop', {
      bubbles: true, cancelable: true, dataTransfer: dt,
      clientX: box.right - 8, clientY: box.top + box.height / 2
    }));
    await new Promise(r => setTimeout(r, 900));

    const stamped = document.querySelector('.term-host[data-stamp="B"]');
    return {
      tabsAfter: document.querySelectorAll('.tabbar .tab').length,
      visiblePanes: document.querySelectorAll('.pane-slot:not(.hidden) .pane').length,
      ptySurvived: stamped ? stamped.__survived === 'yes' : false
    };
  })()`)

  if (remerged.visiblePanes !== 2) {
    return fail(`dropping the pane back should re-split (2 panes), saw ${remerged.visiblePanes}`)
  }
  if (!remerged.ptySurvived) return fail('pane was remounted when dropped back into a split')
  console.log(`  dropped it back onto a pane -> re-split (${remerged.visiblePanes} panes) ✓`)

  // A merged pane must still be splittable — this is the reported bug.
  await js(`(() => {
    const panes = [...document.querySelectorAll('.pane-slot:not(.hidden) .pane')];
    panes[panes.length - 1].querySelector('.term-host').dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true })
    );
    return true;
  })()`)
  await sleep(400)
  chord('E')
  await sleep(1800)

  panes = await js(`document.querySelectorAll('.pane-slot:not(.hidden) .pane').length`)
  if (panes !== 3) return fail(`a merged-in pane should still split; expected 3 panes, got ${panes}`)
  console.log('  a pane that was merged in is still splittable ✓')

  /* ------- 2b. renaming a tab renames the pane header beneath it ----------- */

  // Do this in a tab that holds ONE pane, which is the case the rename covers.
  await js(`document.querySelector('.tab-new').click(); true`)
  await sleep(2000)

  const renamed = await js(`(async () => {
    const tabs = [...document.querySelectorAll('.tabbar .tab')];
    const tab = tabs[tabs.length - 1];
    tab.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await new Promise(r => setTimeout(r, 400));

    const input = document.querySelector('.tabbar .rename');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'my-renamed-tab');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await new Promise(r => setTimeout(r, 600));

    const heads = [...document.querySelectorAll('.pane-slot:not(.hidden) .pane-title')]
      .map(e => e.textContent);
    const bar = [...document.querySelectorAll('.tabbar .tab .tab-name')].map(e => e.textContent);
    return { heads, tabNames: bar };
  })()`)

  if (!renamed.tabNames.includes('my-renamed-tab')) {
    return fail(`the tab itself did not rename: ${JSON.stringify(renamed.tabNames)}`)
  }
  if (!renamed.heads.includes('my-renamed-tab')) {
    return fail(
      `renaming a single-pane tab must rename the pane header under it; header still says ` +
        JSON.stringify(renamed.heads)
    )
  }
  console.log(`  renaming a tab renames the pane header beneath it (${renamed.heads.join(', ')}) ✓`)

  /* --------------------- 3. new tab inherits the cwd ----------------------- */

  const type = async (text) => {
    for (const ch of text) {
      wc.sendInputEvent({ type: 'char', keyCode: ch })
      await sleep(10)
    }
    wc.sendInputEvent({ type: 'keyDown', keyCode: 'Enter' })
    wc.sendInputEvent({ type: 'char', keyCode: '\r' })
    wc.sendInputEvent({ type: 'keyUp', keyCode: 'Enter' })
  }

  // Click the pane first: focusing its textarea alone moves the CARET, but the
  // store's active pane is whatever was last clicked — and the new tab inherits
  // the cwd of the ACTIVE pane, so the two must be the same pane.
  await js(`(() => {
    const host = document.querySelector('.pane-slot:not(.hidden) .term-host');
    host.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    host.querySelector('.xterm-helper-textarea').focus();
    return true;
  })()`)
  await sleep(400)
  await type('cd C:\\Windows')
  await sleep(1500) // let the prompt repaint and report its cwd over OSC 9;9

  await js(`document.querySelector('.tab-new').click(); true`)
  await sleep(2500)

  // Terminal output never touches the store, so wait for the periodic sweep.
  await sleep(11_000)

  const session = readSession()
  const ws = session.workspaces.find((w) => !w.permanent)
  if (!ws) return fail('our workspace is missing from the saved session')
  const newest = ws.tabs[ws.tabs.length - 1]
  const cwd = Object.values(newest.panes)[0].cwd
  if (!/^C:\\Windows$/i.test(cwd)) {
    ws.tabs.forEach((t, i) => {
      Object.values(t.panes).forEach((p) => {
        const tail = (p.scrollback || '').replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '').replace(/\s+/g, ' ').slice(-70)
        console.error(`    tab[${i}] pane ${p.id} cwd=${JSON.stringify(p.cwd)} tail=${JSON.stringify(tail)}`)
      })
    })
    return fail(`new tab should open in the cwd you cd'd to (C:\\Windows), got ${JSON.stringify(cwd)}`)
  }
  console.log(`  cd C:\\Windows then new tab -> new pane opens in ${cwd} ✓`)

  /* --------------------- 4. Shift+Enter must not submit --------------------- */

  /*
   * Assert the BYTES, not the effect.
   *
   * The pane runs cmd, and cmd has no notion of a multi-line prompt: it ignores
   * the ESC and runs the line either way. Only an agent REPL (Claude, and the
   * rest) reads ESC+CR as "newline, keep typing". So there is nothing to observe
   * in a shell — instead, tap the MessagePort that carries keystrokes to the PTY
   * and check what Shift+Enter actually puts on the wire.
   */
  await js(`(() => {
    window.__sent = [];
    const orig = MessagePort.prototype.postMessage;
    MessagePort.prototype.postMessage = function (d) {
      if (typeof d === 'string') window.__sent.push(d);
      return orig.apply(this, arguments);
    };
    const host = document.querySelector('.pane-slot:not(.hidden) .term-host');
    host.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    host.querySelector('.xterm-helper-textarea').focus();
    return true;
  })()`)
  await sleep(400)

  wc.sendInputEvent({ type: 'keyDown', keyCode: 'Enter', modifiers: ['shift'] })
  wc.sendInputEvent({ type: 'keyUp', keyCode: 'Enter', modifiers: ['shift'] })
  await sleep(600)
  const shiftSent = await js(`window.__sent.slice()`)

  await js(`window.__sent = []; true`)
  wc.sendInputEvent({ type: 'keyDown', keyCode: 'Enter' })
  wc.sendInputEvent({ type: 'char', keyCode: '\r' })
  wc.sendInputEvent({ type: 'keyUp', keyCode: 'Enter' })
  await sleep(600)
  const plainSent = await js(`window.__sent.slice()`)

  if (!shiftSent.includes('\x1b\r')) {
    return fail(`Shift+Enter should send ESC+CR, sent ${JSON.stringify(shiftSent)}`)
  }
  if (shiftSent.includes('\r')) {
    return fail(`Shift+Enter also sent a bare CR (it would submit): ${JSON.stringify(shiftSent)}`)
  }
  if (!plainSent.includes('\r')) {
    return fail(`plain Enter must still submit (bare CR), sent ${JSON.stringify(plainSent)}`)
  }
  console.log('  Shift+Enter sends ESC+CR (newline), plain Enter still sends CR (submit) ✓')

  /*
   * The state file carries every terminal's scrollback now. Pretty-printing it
   * roughly doubles the bytes, and it used to be stringified and written
   * SYNCHRONOUSLY on the main process — the same thread that ferries PTY bytes
   * to the renderer, which is why typing stalled. Keep it compact.
   */
  const raw = fs.readFileSync(stateFile, 'utf8')
  if (/^\s{2}"/m.test(raw)) {
    return fail('state file is pretty-printed — that doubles the bytes written on the PTY thread')
  }
  console.log(`  state file is compact (${Math.round(raw.length / 1024)} KB) ✓`)

  console.log('PANES PASS')
  app.exit(0)
})
