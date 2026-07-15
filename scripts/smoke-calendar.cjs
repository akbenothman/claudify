/**
 * Calendar smoke test.
 *
 * The calendar makes the same bet the dashboard does: an agent (with the Google
 * Calendar MCP) owns calendar.json, and the pane reflects it live and writes
 * requests back. We test both directions literally — write an event to the file
 * from OUTSIDE the app and assert it renders, then add one through the UI and
 * assert a request lands in the file.
 *
 *   npm run build && npx electron scripts/smoke-calendar.cjs
 */
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const { stateFile, userData } = require('./sandbox.cjs')('calendar')
const calFile = path.join(userData, 'calendar.json')
if (fs.existsSync(stateFile)) fs.rmSync(stateFile)
if (fs.existsSync(calFile)) fs.rmSync(calFile)

require('../out/main/index.js')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fail = (msg) => {
  console.error(`CALENDAR FAIL: ${msg}`)
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

  // The dashboard workspace gained a calendar tab, so its board exists in the DOM.
  const hasBoard = await js(`!!document.querySelector('.board.calendar')`)
  if (!hasBoard) return fail('no calendar board rendered on the dashboard')
  console.log('  calendar board present ✓')

  /* ---- the one that matters: an agent fills calendar.json, UI reflects it --- */

  // Noon today (local), so it always lands on the calendar's default-selected
  // day (today) no matter what time the test runs.
  const noon = new Date()
  noon.setHours(12, 0, 0, 0)
  const start = noon.toISOString()
  fs.writeFileSync(
    calFile,
    JSON.stringify({
      events: [{ id: 'e1', title: 'Dentist', start, location: 'Downtown', source: 'google' }],
      requests: [],
      syncedAt: new Date().toISOString()
    }),
    'utf8'
  )
  await sleep(1800) // no reload — the app watches the file itself

  const shown = await js(
    `[...document.querySelectorAll('.board.calendar .cal-title')].map(e => e.textContent).join('|')`
  )
  if (!/Dentist/.test(shown)) {
    return fail(`event written to calendar.json did not render: ${JSON.stringify(shown)}`)
  }
  console.log(`  agent-written event rendered live: ${JSON.stringify(shown)} ✓`)

  /* ------------- UI -> file: adding an event writes a request --------------- */

  await js(`(() => {
    const board = document.querySelector('.board.calendar');
    const inputs = board.querySelectorAll('.board-add input');
    const set = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      s.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    set(inputs[0], 'Team sync');
    set(inputs[1], 'tomorrow 10am');
    inputs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    return true;
  })()`)
  await sleep(800)

  const onDisk = JSON.parse(fs.readFileSync(calFile, 'utf8'))
  const req = (onDisk.requests || []).find((r) => r.action === 'add' && r.title === 'Team sync')
  if (!req) {
    return fail(`adding an event did not write an add request: ${JSON.stringify(onDisk.requests)}`)
  }
  if (req.start !== 'tomorrow 10am') {
    return fail(`the request lost the "when" the user typed: ${JSON.stringify(req)}`)
  }
  console.log('  adding an event in the UI wrote an add request to calendar.json ✓')

  /* ----------------- deleting an event writes a delete request -------------- */

  await js(`document.querySelector('.board.calendar .cal-event .pane-x').click()`)
  await sleep(800)
  const after = JSON.parse(fs.readFileSync(calFile, 'utf8'))
  if (!(after.requests || []).some((r) => r.action === 'delete' && r.eventId === 'e1')) {
    return fail(`deleting an event did not write a delete request: ${JSON.stringify(after.requests)}`)
  }
  console.log('  deleting an event wrote a delete request ✓')

  console.log('CALENDAR PASS')
  app.exit(0)
})
