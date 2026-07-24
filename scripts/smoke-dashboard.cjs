/**
 * AK Dashboard smoke test.
 *
 * The claim that matters: an agent can change the state of your life-admin by
 * editing dashboard.json, and the UI reflects it live. We test that literally —
 * write the file from OUTSIDE the app (exactly as Claude's file tools would) and
 * assert the rendered pages change without a reload.
 *
 * The second claim, since the dashboard was re-cut: it is a set of PAGES, one
 * per tab, not a split of panes. So we also assert the tab strip carries every
 * page and that a page fills its tab with no pane chrome around it.
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

/** Every page the dashboard is supposed to carry, by tab title. */
const PAGES = [
  'home',
  'todo',
  'goals',
  'habits',
  'business',
  'finance',
  'notes',
  'calendar',
  'sessions',
  'claude'
]

app.whenReady().then(async () => {
  const win = BrowserWindow.getAllWindows()[0]
  if (win.webContents.isLoading()) {
    await new Promise((r) => win.webContents.once('did-finish-load', r))
  }
  win.focus()
  await sleep(3000)
  const js = (src) => win.webContents.executeJavaScript(src)

  /** Bring a page to the front by clicking its tab (pages are keyed by title). */
  const open = async (title) => {
    const ok = await js(`(() => {
      const tab = [...document.querySelectorAll('.tab-page .tab')]
        .find(t => t.querySelector('.tab-name')?.textContent === ${JSON.stringify(title)});
      if (!tab) return false;
      tab.click();
      return true;
    })()`)
    if (!ok) return fail(`no dashboard tab titled '${title}'`)
    await sleep(400)
    return true
  }

  // --- the permanent workspace exists, is first, and is a strip of pages ---
  const boot = await js(`(() => ({
    firstWs: document.querySelector('.ws .ws-name')?.textContent,
    pinned: !!document.querySelector('.ws .ws-pin'),
    tabs: [...document.querySelectorAll('.tab-page .tab .tab-name')].map(e => e.textContent),
    glyphs: document.querySelectorAll('.tab-page .tab-glyph').length,
    closable: document.querySelectorAll('.tab-page .tab-x').length,
    pages: [...document.querySelectorAll('.page')].map(p => p.className.replace('page ', '')),
    // A page owns its tab: no pane title bar above it.
    chromeless: document.querySelectorAll('.pane.bare').length,
    headsOnPages: document.querySelectorAll('.pane.bare .pane-head').length
  }))()`)

  if (!/AK Dashboard/.test(boot.firstWs || '')) {
    return fail(`first workspace is '${boot.firstWs}', expected 'AK Dashboard'`)
  }
  if (!boot.pinned) return fail('dashboard is not marked permanent')

  const missing = PAGES.filter((p) => !boot.tabs.includes(p))
  if (missing.length > 0) {
    return fail(`missing dashboard pages ${JSON.stringify(missing)}; got ${JSON.stringify(boot.tabs)}`)
  }
  if (boot.glyphs < PAGES.length) {
    return fail(`every page tab should carry an icon; ${boot.glyphs} of ${PAGES.length} did`)
  }
  if (boot.closable > 0) {
    return fail(`dashboard pages must not offer a close button (${boot.closable} did)`)
  }
  if (boot.headsOnPages > 0) {
    return fail(`a full-tab page still draws pane chrome (${boot.headsOnPages} title bars)`)
  }
  if (boot.chromeless < PAGES.length) {
    return fail(`expected ${PAGES.length} chrome-free panes, got ${boot.chromeless}`)
  }
  console.log(`  workspace: ${boot.firstWs} (permanent)`)
  console.log(`  pages: ${boot.tabs.join(', ')}`)
  console.log('  each page fills its tab, with no pane title bar ✓')

  // --- deleting the workspace must be impossible ---
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

  /* --------------------------------- todo ---------------------------------- */

  await open('todo')

  await js(`(() => {
    const input = document.querySelector('.page-todo .page-add input');
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
    const board = document.querySelector('.page-todo');
    board.querySelector('.board-tab-new').click();
    await new Promise(r => setTimeout(r, 400));

    const input = board.querySelector('.board-tab .rename');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'errands');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await new Promise(r => setTimeout(r, 500));

    // Add an item — it must land in the NEW topic, not the first one.
    const add = board.querySelector('.page-add input');
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
    return fail(
      `switching topic must switch lists; still showing the other topic's items: ${JSON.stringify(topics.rows)}`
    )
  }

  onDisk = JSON.parse(fs.readFileSync(dashFile, 'utf8'))
  const errands = onDisk.topics.find((t) => t.name === 'errands')
  if (!errands || errands.todos[0]?.text !== 'buy milk') {
    return fail(`the item did not land in its own topic: ${JSON.stringify(onDisk.topics)}`)
  }
  console.log(`  topics are tabs, each with its own list: ${JSON.stringify(topics.tabs)} ✓`)

  /* --------------------- topic tabs can be reordered ----------------------- */

  const reordered = await js(`(async () => {
    const board = document.querySelector('.page-todo');
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
    const board = document.querySelector('.page-todo');
    // Cycle the item to 'done' (todo -> doing -> blocked -> done).
    for (let i = 0; i < 3; i++) {
      board.querySelector('.row .chip').click();
      await new Promise(r => setTimeout(r, 250));
    }
    const before = board.querySelectorAll('.row').length;
    const clear = [...board.querySelectorAll('.card-head .ghost')]
      .find(b => /clear done/i.test(b.textContent));
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

  await open('notes')

  const notes = await js(`(async () => {
    const board = document.querySelector('.page-notes');
    if (!board) return { ok: false, why: 'no notes page on the dashboard' };

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
    const board = document.querySelector('.page-notes');
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

  /* ------------------------ habits are clickable days ---------------------- */

  await open('habits')

  const habit = await js(`(async () => {
    const page = document.querySelector('.page-habits');
    if (!page) return { ok: false, why: 'no habits page' };
    const input = page.querySelector('.page-add input');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'gym');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await new Promise(r => setTimeout(r, 600));

    // The last dot in the row is today.
    const days = [...page.querySelectorAll('.habit-grid .hd')];
    days[days.length - 1].click();
    await new Promise(r => setTimeout(r, 600));
    return {
      ok: true,
      streak: page.querySelector('.habit-streak')?.textContent,
      lit: page.querySelectorAll('.habit-grid .hd.on').length
    };
  })()`)

  if (!habit.ok) return fail(habit.why)
  if (habit.lit !== 1) return fail(`clicking today should light exactly one day, lit ${habit.lit}`)

  onDisk = JSON.parse(fs.readFileSync(dashFile, 'utf8'))
  const gym = (onDisk.habits || []).find((h) => h.name === 'gym')
  if (!gym || gym.done.length !== 1) {
    return fail(`the habit tick did not reach the file: ${JSON.stringify(onDisk.habits)}`)
  }
  console.log(`  habits: ticked today -> "${habit.streak}", saved to dashboard.json ✓`)

  /* ---------------- THE ONE THAT MATTERS: edit the file as Claude ---------- */

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
    goals: [
      {
        id: 'g1',
        title: 'launch the course site',
        horizon: 'quarter',
        progress: 40,
        updated: new Date().toISOString()
      }
    ],
    ventures: [
      { id: 'v1', name: 'cert prep co', stage: 'launched', mrr: 1200, nextAction: 'run ads' }
    ],
    finance: {
      currency: '$',
      accounts: [
        { id: 'a1', name: 'checking', kind: 'bank', balance: 9000 },
        { id: 'a2', name: 'card', kind: 'credit', balance: 1500, liability: true }
      ],
      recurring: [{ id: 'r1', name: 'rent', amount: 2000, cadence: 'monthly', direction: 'out' }]
    }
  }
  fs.writeFileSync(dashFile, JSON.stringify(edited, null, 2), 'utf8')

  // No reload, no IPC from us — the app must notice the file changed by itself.
  await sleep(1800)

  const live = await js(`(() => ({
    chips: [...document.querySelectorAll('.page-todo .chip')].map(c => c.textContent.trim()),
    texts: [...document.querySelectorAll('.page-todo .row-text')].map(c => c.textContent.trim()),
    topicTabs: [...document.querySelectorAll('.page-todo .board-tab-name')].map(e => e.textContent),
    noteBody: document.querySelector('.page-notes .notes-body')?.value,
    goals: [...document.querySelectorAll('.page-goals .goal-title')].map(e => e.textContent),
    goalPct: [...document.querySelectorAll('.page-goals .goal-pct')].map(e => e.textContent),
    ventures: [...document.querySelectorAll('.page-business .venture-name')].map(e => e.textContent),
    accounts: [...document.querySelectorAll('.page-finance .fin-name')].map(e => e.value),
    netWorth: document.querySelector('.page-finance .stat-value')?.textContent
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
  if (!live.chips.some((c) => c.includes('done'))) {
    return fail(`status change to 'done' did not render. Chips: ${JSON.stringify(live.chips)}`)
  }
  if (!live.goals.includes('launch the course site') || !live.goalPct.includes('40%')) {
    return fail(`an agent-written goal did not render: ${JSON.stringify(live.goals)} ${JSON.stringify(live.goalPct)}`)
  }
  if (!live.ventures.includes('cert prep co')) {
    return fail(`an agent-written venture did not render: ${JSON.stringify(live.ventures)}`)
  }
  if (!live.accounts.includes('checking') || !live.accounts.includes('card')) {
    return fail(`agent-written accounts did not render: ${JSON.stringify(live.accounts)}`)
  }
  // 9000 assets less 1500 of debt. Under 10k it's shown in full, not abbreviated.
  if (!/7,?500/.test(live.netWorth || '')) {
    return fail(`net worth should net debts off assets, showed '${live.netWorth}'`)
  }

  console.log(`  edited dashboard.json from outside the app (as Claude would)`)
  console.log(`  agent-added topic tab + note body landed live ✓`)
  console.log(`  UI live-updated: ${JSON.stringify(live.texts)}`)
  console.log(`  statuses now: ${JSON.stringify(live.chips)}`)
  console.log(`  goals ${JSON.stringify(live.goals)} · business ${JSON.stringify(live.ventures)}`)
  console.log(`  finance: ${JSON.stringify(live.accounts)} -> net worth ${live.netWorth} ✓`)
  console.log('DASHBOARD PASS')
  app.exit(0)
})
