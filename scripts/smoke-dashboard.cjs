/**
 * AK Dashboard smoke test.
 *
 * The claim that matters: an agent can change the status of things by editing
 * dashboard.json, and the UI reflects it live. We test that literally — write
 * the file from OUTSIDE the app (exactly as Claude's file tools would) and
 * assert the rendered rows change without a reload.
 *
 *   npm run build && npx electron scripts/smoke-dashboard.cjs
 */
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

app.setName('Claudify')

const userData = app.getPath('userData')
const stateFile = path.join(userData, 'claudify-state.json')
const dashFile = path.join(userData, 'dashboard.json')
if (fs.existsSync(stateFile)) fs.rmSync(stateFile)
if (fs.existsSync(dashFile)) fs.rmSync(dashFile)

require('../out/main/index.js')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fail = (msg) => {
  console.error(`DASHBOARD FAIL: ${msg}`)
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

  // --- the permanent workspace exists, is first, and has the right 4 panes ---
  const boot = await js(`(() => ({
    firstWs: document.querySelector('.ws .ws-name')?.textContent,
    pinned: !!document.querySelector('.ws .ws-pin'),
    paneTitles: [...document.querySelectorAll('.pane-slot:not(.hidden) .pane-title')].map(e => e.textContent),
    hasTodo: !!document.querySelector('.board'),
    boards: document.querySelectorAll('.board').length
  }))()`)

  if (!/AK Dashboard/.test(boot.firstWs || '')) {
    return fail(`first workspace is '${boot.firstWs}', expected 'AK Dashboard'`)
  }
  if (!boot.pinned) return fail('dashboard is not marked permanent')
  if (boot.boards !== 2) return fail(`expected 2 boards (todo + tracker), got ${boot.boards}`)
  console.log(`  workspace: ${boot.firstWs} (permanent)`)
  console.log(`  panes: ${boot.paneTitles.join(', ')}`)

  // --- deleting it must be impossible ---
  const menu = await js(`(async () => {
    document.querySelector('.ws').dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, clientX: 60, clientY: 120 })
    );
    await new Promise(r => setTimeout(r, 300));
    const items = [...document.querySelectorAll('.menu-item')].map(e => e.textContent);
    document.querySelector('.menu-backdrop').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    return items;
  })()`)
  if (menu.some((m) => /delete/i.test(m))) {
    return fail(`dashboard offers a delete option: ${JSON.stringify(menu)}`)
  }
  console.log(`  context menu (no delete): ${JSON.stringify(menu)}`)

  // --- add a todo through the UI, and check it lands in the file ---
  await js(`(() => {
    const board = document.querySelectorAll('.board')[0];
    const input = board.querySelector('.board-add input');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'ship claudify');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    return true;
  })()`)
  await sleep(800)

  const onDisk = JSON.parse(fs.readFileSync(dashFile, 'utf8'))
  if (onDisk.todos?.[0]?.text !== 'ship claudify') {
    return fail(`todo did not reach the file: ${JSON.stringify(onDisk.todos)}`)
  }
  console.log(`  added a todo in the UI -> it appears in dashboard.json ✓`)

  // --- THE ONE THAT MATTERS: edit the file the way Claude would ---
  const edited = {
    ...onDisk,
    todos: [
      { ...onDisk.todos[0], status: 'done', updated: new Date().toISOString() },
      { id: 'x1', text: 'added by claude', status: 'doing', updated: new Date().toISOString() }
    ],
    conversations: [
      { id: 'c1', title: 'worktree split design', status: 'waiting', updated: new Date().toISOString() }
    ]
  }
  fs.writeFileSync(dashFile, JSON.stringify(edited, null, 2), 'utf8')

  // No reload, no IPC from us — the app must notice the file changed by itself.
  await sleep(1500)

  const live = await js(`(() => ({
    chips: [...document.querySelectorAll('.board .chip')].map(c => c.textContent.trim()),
    texts: [...document.querySelectorAll('.board .row-text')].map(c => c.textContent.trim())
  }))()`)

  if (!live.texts.includes('added by claude')) {
    return fail(`UI did not pick up the agent's file edit. Rows: ${JSON.stringify(live.texts)}`)
  }
  if (!live.texts.includes('worktree split design')) {
    return fail(`conversation tracker did not update. Rows: ${JSON.stringify(live.texts)}`)
  }
  if (!live.chips.some((c) => c.includes('done'))) {
    return fail(`status change to 'done' did not render. Chips: ${JSON.stringify(live.chips)}`)
  }

  console.log(`  edited dashboard.json from outside the app (as Claude would)`)
  console.log(`  UI live-updated: ${JSON.stringify(live.texts)}`)
  console.log(`  statuses now: ${JSON.stringify(live.chips)}`)
  console.log('DASHBOARD PASS')
  app.exit(0)
})
