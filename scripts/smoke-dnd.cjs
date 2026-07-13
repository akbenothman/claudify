/**
 * Drag-and-drop smoke test.
 *
 * The load-bearing assertion here is PTY SURVIVAL. Moving a tab to another
 * workspace must not tear down its DOM node, because that would unmount the
 * terminal and kill whatever agent is running in it. We prove the node survived
 * by stamping a JS property on it before the move and checking it's still there
 * after â€” a remount would produce a fresh element without it.
 *
 *   npm run build && npx electron scripts/smoke-dnd.cjs
 */
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

app.setName('Claudify')

// Start from a clean slate: session persistence would otherwise restore whatever
// layout the last run left behind, and the assertions below assume one pane.
const stateFile = path.join(app.getPath('userData'), 'claudify-state.json')
if (fs.existsSync(stateFile)) fs.rmSync(stateFile)

require('../out/main/index.js')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fail = (msg) => {
  console.error(`DND FAIL: ${msg}`)
  app.exit(1)
}

app.whenReady().then(async () => {
  const win = BrowserWindow.getAllWindows()[0]
  if (win.webContents.isLoading()) {
    await new Promise((r) => win.webContents.once('did-finish-load', r))
  }
  win.focus()
  await sleep(2500)
  const wc = win.webContents

  const js = (src) => wc.executeJavaScript(src)

  // Work in a fresh workspace: workspace 1 is now the permanent AK Dashboard,
  // which already has four panes.
  await js(`document.querySelector('.ws-new').click(); true`)
  await sleep(2000)

  // --- geometry: panes must have real, non-degenerate rects ---
  const geom = await js(`(() => {
    const slots = [...document.querySelectorAll('.pane-slot:not(.hidden)')];
    return slots.map(s => {
      const p = s.querySelector('.pane').getBoundingClientRect();
      return Math.round(p.width) + 'x' + Math.round(p.height);
    });
  })()`)
  if (geom.length !== 1 || geom[0].startsWith('0x') || /x[0-9]$/.test(geom[0])) {
    return fail(`bad initial pane geometry: ${JSON.stringify(geom)}`)
  }
  console.log(`  initial pane: ${geom[0]}`)

  // --- split, and check both panes get sane rects from the flat layout ---
  wc.sendInputEvent({ type: 'keyDown', keyCode: 'D', modifiers: ['control', 'shift'] })
  await sleep(2000)
  const split = await js(`(() => {
    const panes = [...document.querySelectorAll('.pane-slot:not(.hidden) .pane')];
    return panes.map(p => { const r = p.getBoundingClientRect(); return Math.round(r.width) + 'x' + Math.round(r.height); });
  })()`)
  if (split.length !== 2) return fail(`expected 2 panes after split, got ${split.length}`)
  console.log(`  after split-right: ${split.join('  |  ')}`)

  // --- stamp the pane's terminal node so we can detect a remount ---
  await js(`(() => {
    const host = document.querySelector('.pane .term-host');
    host.__survived = 'yes';
    host.dataset.stamp = 'A';
    return true;
  })()`)

  const before = await js(`(() => {
    const t = document.querySelector('.tabbar .tab');
    return { wsId: t.dataset.wsId, tabId: t.dataset.tabId };
  })()`)

  // --- make a second workspace, then drag the tab onto it ---
  await js(`document.querySelector('.ws-new').click(); true`)
  await sleep(2000)

  const moved = await js(`(async () => {
    const rows = [...document.querySelectorAll('.ws')];
    // [0] is the dashboard, [1] is our working workspace, [2] is the new target.
    if (rows.length < 3) return { ok: false, why: 'target workspace was not created' };
    const target = rows[rows.length - 1];

    const dt = new DataTransfer();
    dt.setData('application/x-claudify-tab', JSON.stringify({
      wsId: ${JSON.stringify(before.wsId)}, tabId: ${JSON.stringify(before.tabId)}
    }));
    target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    await new Promise(r => setTimeout(r, 600));

    const stamped = document.querySelector('.term-host[data-stamp="A"]');
    return {
      ok: true,
      tabsInBar: document.querySelectorAll('.tabbar .tab').length,
      wsCounts: [...document.querySelectorAll('.ws .ws-count')].map(e => e.textContent),
      nodeStillThere: !!stamped,
      ptySurvived: stamped ? stamped.__survived === 'yes' : false
    };
  })()`)

  if (!moved.ok) return fail(moved.why)
  if (!moved.nodeStillThere) return fail('the terminal DOM node vanished after the move')
  if (!moved.ptySurvived) {
    return fail('terminal was REMOUNTED by the move â€” its PTY (and any agent) would have been killed')
  }
  console.log(`  moved tab to workspace 2; ws tab counts now [${moved.wsCounts.join(', ')}]`)
  console.log('  terminal DOM node survived the move â†’ PTY intact âœ“')

  // --- drop a tab onto a pane: the two should combine into one split ---
  const combined = await js(`(async () => {
    const bar = [...document.querySelectorAll('.tabbar .tab')];
    if (bar.length < 2) return { ok: false, why: 'need 2 tabs in the bar to test combining, got ' + bar.length };

    // Drag tab[0] onto a pane belonging to tab[1].
    const src = { wsId: bar[0].dataset.wsId, tabId: bar[0].dataset.tabId };
    bar[1].click();
    await new Promise(r => setTimeout(r, 400));

    // Panes are now a FLAT list across every tab, so we must pick a visible one
    // that actually belongs to the active tab — otherwise we'd self-drop onto a
    // hidden pane of the source tab and silently no-op.
    const pane = document.querySelector('.pane-slot:not(.hidden) .pane');
    if (pane.dataset.tabId === src.tabId) return { ok: false, why: 'picked a pane from the source tab' };
    const dstTabId = pane.dataset.tabId;
    const box = pane.getBoundingClientRect();

    const dt = new DataTransfer();
    dt.setData('application/x-claudify-tab', JSON.stringify(src));
    pane.dispatchEvent(new DragEvent('drop', {
      bubbles: true, cancelable: true, dataTransfer: dt,
      clientX: box.right - 8, clientY: box.top + box.height / 2   // right edge -> split right
    }));
    await new Promise(r => setTimeout(r, 800));

    return {
      ok: true,
      tabsBefore: bar.length,
      tabsInBar: document.querySelectorAll('.tabbar .tab').length,
      visiblePanes: document.querySelectorAll('.pane-slot:not(.hidden)').length,
      // Every visible pane must now belong to the destination tab — that's what
      // "the tabs were combined" actually means.
      allInDstTab: [...document.querySelectorAll('.pane-slot:not(.hidden) .pane')]
        .every(p => p.dataset.tabId === dstTabId),
      stampSurvived: (() => {
        const s = document.querySelector('.term-host[data-stamp="A"]');
        return s ? s.__survived === 'yes' : false;
      })()
    };
  })()`)

  if (!combined.ok) return fail(combined.why)
  if (combined.tabsInBar !== combined.tabsBefore - 1) {
    return fail(
      `combine should consume the source tab: ${combined.tabsBefore} tabs before, ${combined.tabsInBar} after`
    )
  }
  if (combined.visiblePanes < 3) {
    return fail(`combining should have merged panes into one split; visible panes = ${combined.visiblePanes}`)
  }
  if (!combined.allInDstTab) return fail('merged panes did not all land in the destination tab')
  if (!combined.stampSurvived) {
    return fail('terminal was remounted when tabs were combined â€” PTY would have been killed')
  }
  console.log(
    `  combined a tab into a pane: ${combined.tabsInBar} tab(s) left, ${combined.visiblePanes} panes in split`
  )
  console.log('  terminal survived the combine too âœ“')

  console.log('DND PASS')
  app.exit(0)
})

