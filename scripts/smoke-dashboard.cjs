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

// Own userData dir: this test wipes both state files, and those are the user's
// real session and real todo list under the app's normal profile.
const { stateFile, dashFile } = require('./sandbox.cjs')('dashboard')
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
  // notes + todo + tracker on the dashboard tab, plus a calendar board on its
  // own tab (rendered but hidden). All four are `.board` elements in the DOM.
  if (boot.boards !== 4) {
    return fail(`expected 4 boards (notes + todo + tracker + calendar), got ${boot.boards}`)
  }
  if (!boot.paneTitles.includes('notes')) {
    return fail(`the dashboard should carry a notepad, not a shell: ${JSON.stringify(boot.paneTitles)}`)
  }
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
    const input = document.querySelector('.board.todo .board-add input');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'ship claudify');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    return true;
  })()`)
  await sleep(800)

  let onDisk = JSON.parse(fs.readFileSync(dashFile, 'utf8'))
  if (onDisk.topics?.[0]?.todos?.[0]?.text !== 'ship claudify') {
    return fail(`todo did not reach the file: ${JSON.stringify(onDisk.topics)}`)
  }
  console.log(`  added a todo in the UI -> it appears in dashboard.json under a topic ✓`)

  /* ------------------------- topics are tabs ------------------------------- */

  const topics = await js(`(async () => {
    const board = document.querySelector('.board.todo');
    board.querySelector('.board-tab-new').click();
    await new Promise(r => setTimeout(r, 400));

    const input = board.querySelector('.board-tab .rename');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'errands');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await new Promise(r => setTimeout(r, 500));

    // Add an item — it must land in the NEW topic, not the first one.
    const add = board.querySelector('.board-add input');
    setter.call(add, 'buy milk');
    add.dispatchEvent(new Event('input', { bubbles: true }));
    add.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await new Promise(r => setTimeout(r, 600));

    return {
      tabs: [...board.querySelectorAll('.board-tab-name')].map(e => e.textContent),
      rows: [...board.querySelectorAll('.row-text')].map(e => e.textContent)
    };
  })()`)

  if (!topics.tabs.includes('errands')) {
    return fail(`new topic tab did not appear: ${JSON.stringify(topics.tabs)}`)
  }
  if (topics.rows.includes('ship claudify')) {
    return fail(`switching topic must switch lists; still showing the other topic's items: ${JSON.stringify(topics.rows)}`)
  }

  onDisk = JSON.parse(fs.readFileSync(dashFile, 'utf8'))
  const errands = onDisk.topics.find((t) => t.name === 'errands')
  if (!errands || errands.todos[0]?.text !== 'buy milk') {
    return fail(`the item did not land in its own topic: ${JSON.stringify(onDisk.topics)}`)
  }
  console.log(`  topics are tabs, each with its own list: ${JSON.stringify(topics.tabs)} ✓`)

  /* --------------------- topic tabs can be reordered ----------------------- */

  const reordered = await js(`(async () => {
    const board = document.querySelector('.board.todo');
    const tabs = [...board.querySelectorAll('.board-tab')];
    const before = tabs.map(t => t.querySelector('.board-tab-name').textContent);

    // Drag the LAST tab (errands) to the front, dropping on the left half of the
    // first tab so it lands before it.
    const target = tabs[0];
    const box = target.getBoundingClientRect();
    const dt = new DataTransfer();
    dt.setData('application/x-claudify-topic', String(tabs.length - 1));
    target.dispatchEvent(new DragEvent('drop', {
      bubbles: true, cancelable: true, dataTransfer: dt,
      clientX: box.left + 2, clientY: box.top + box.height / 2
    }));
    await new Promise(r => setTimeout(r, 700));

    return {
      before,
      after: [...board.querySelectorAll('.board-tab-name')].map(t => t.textContent)
    };
  })()`)

  if (reordered.after[0] !== 'errands') {
    return fail(
      `dragging a topic tab to the front should reorder it: ${JSON.stringify(reordered.before)} -> ` +
        JSON.stringify(reordered.after)
    )
  }
  onDisk = JSON.parse(fs.readFileSync(dashFile, 'utf8'))
  if (onDisk.topics[0].name !== 'errands') {
    return fail(`the new topic order did not persist: ${JSON.stringify(onDisk.topics.map((t) => t.name))}`)
  }
  console.log(
    `  topic tabs reorder by drag: ${JSON.stringify(reordered.before)} -> ${JSON.stringify(reordered.after)} ✓`
  )

  /* ----------------------- clearing completed items ------------------------ */

  const cleared = await js(`(async () => {
    const board = document.querySelector('.board.todo');
    // Cycle the item to 'done' (todo -> doing -> blocked -> done).
    for (let i = 0; i < 3; i++) {
      board.querySelector('.row .chip').click();
      await new Promise(r => setTimeout(r, 250));
    }
    const before = board.querySelectorAll('.row').length;
    const clear = board.querySelector('.board-clear');
    if (!clear) return { ok: false, why: 'no "clear done" button appeared for a completed item' };
    clear.click();
    await new Promise(r => setTimeout(r, 600));
    return { ok: true, before, after: board.querySelectorAll('.row').length };
  })()`)

  if (!cleared.ok) return fail(cleared.why)
  if (cleared.after !== 0) {
    return fail(`clear done should have removed the completed item (${cleared.before} -> ${cleared.after})`)
  }
  console.log('  marking an item done and clearing it removes it ✓')

  /* ------------------------------ the notepad ------------------------------ */

  const notes = await js(`(async () => {
    const board = document.querySelector('.board.notes');
    if (!board) return { ok: false, why: 'no notepad pane on the dashboard' };

    const ta = board.querySelector('.notes-body');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    setter.call(ta, 'first line\\nsecond line');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 900));   // past the save debounce

    // A second page, named, with its own body.
    board.querySelector('.board-tab-new').click();
    await new Promise(r => setTimeout(r, 400));
    const rename = board.querySelector('.board-tab .rename');
    const nameSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    nameSetter.call(rename, 'page 2');
    rename.dispatchEvent(new Event('input', { bubbles: true }));
    rename.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await new Promise(r => setTimeout(r, 500));

    const ta2 = board.querySelector('.notes-body');
    setter.call(ta2, 'other page');
    ta2.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 900));

    return { ok: true, tabs: [...board.querySelectorAll('.board-tab-name')].map(e => e.textContent) };
  })()`)

  if (!notes.ok) return fail(notes.why)
  if (notes.tabs.length < 2) return fail(`notepad should have 2 tabs, got ${JSON.stringify(notes.tabs)}`)

  // Note pages reorder the same way.
  const notesMoved = await js(`(async () => {
    const board = document.querySelector('.board.notes');
    const tabs = [...board.querySelectorAll('.board-tab')];
    const target = tabs[0];
    const box = target.getBoundingClientRect();
    const dt = new DataTransfer();
    dt.setData('application/x-claudify-note', String(tabs.length - 1));
    target.dispatchEvent(new DragEvent('drop', {
      bubbles: true, cancelable: true, dataTransfer: dt,
      clientX: box.left + 2, clientY: box.top + box.height / 2
    }));
    await new Promise(r => setTimeout(r, 700));
    return [...board.querySelectorAll('.board-tab-name')].map(t => t.textContent);
  })()`)

  if (notesMoved[0] !== 'page 2') {
    return fail(`note pages should reorder by drag, got ${JSON.stringify(notesMoved)}`)
  }
  console.log(`  note pages reorder by drag: ${JSON.stringify(notesMoved)} ✓`)

  onDisk = JSON.parse(fs.readFileSync(dashFile, 'utf8'))
  const bodies = (onDisk.notes || []).map((n) => n.body)
  if (!bodies.includes('first line\nsecond line')) {
    return fail(`note body (with its newline) did not reach the file: ${JSON.stringify(bodies)}`)
  }
  if (!bodies.includes('other page')) {
    return fail(`the second note page was not saved separately: ${JSON.stringify(bodies)}`)
  }
  console.log(`  notepad: ${notes.tabs.length} pages, each saved to dashboard.json ✓`)

  // --- THE ONE THAT MATTERS: edit the file the way Claude would ---
  const edited = {
    ...onDisk,
    topics: [
      {
        id: 'general',
        name: 'General',
        todos: [
          { id: 'x0', text: 'ship claudify', status: 'done', updated: new Date().toISOString() },
          { id: 'x1', text: 'added by claude', status: 'doing', updated: new Date().toISOString() }
        ]
      },
      { id: 'later', name: 'later', todos: [] }
    ],
    notes: [{ id: 'n1', name: 'from claude', body: 'written by an agent' }],
    conversations: [
      { id: 'c1', title: 'worktree split design', status: 'waiting', updated: new Date().toISOString() }
    ]
  }
  fs.writeFileSync(dashFile, JSON.stringify(edited, null, 2), 'utf8')

  // No reload, no IPC from us — the app must notice the file changed by itself.
  await sleep(1800)

  const live = await js(`(() => ({
    chips: [...document.querySelectorAll('.board .chip')].map(c => c.textContent.trim()),
    texts: [...document.querySelectorAll('.board .row-text')].map(c => c.textContent.trim()),
    topicTabs: [...document.querySelectorAll('.board.todo .board-tab-name')].map(e => e.textContent),
    noteBody: document.querySelector('.board.notes .notes-body')?.value
  }))()`)

  if (!live.topicTabs.includes('later')) {
    return fail(`a topic added by an agent did not appear as a tab: ${JSON.stringify(live.topicTabs)}`)
  }
  if (live.noteBody !== 'written by an agent') {
    return fail(`the notepad did not pick up the agent's edit: ${JSON.stringify(live.noteBody)}`)
  }

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
  console.log(`  agent-added topic tab + note body landed live ✓`)
  console.log(`  UI live-updated: ${JSON.stringify(live.texts)}`)
  console.log(`  statuses now: ${JSON.stringify(live.chips)}`)
  console.log('DASHBOARD PASS')
  app.exit(0)
})
