/**
 * Status stability + the manual unread flag.
 *
 *   1. A TUI repainting IDENTICAL content must not read as "working". This is
 *      what made the dot flicker blue→green under an agent that had been idle
 *      for ages: it redraws its footer on a timer, and every byte was taken as
 *      work. Output that genuinely changes the screen must still register.
 *   2. A tab marked unread stays lit even while you sit on it — unlike a pane's
 *      `unseen`, which looking at the tab is meant to clear.
 *
 *   npm run build && npx electron scripts/smoke-status.cjs
 */
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const { stateFile, userData } = require('./sandbox.cjs')('status')
if (fs.existsSync(stateFile)) fs.rmSync(stateFile)

require('../out/main/index.js')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fail = (msg) => {
  console.error(`STATUS FAIL: ${msg}`)
  app.exit(1)
}

/*
 * Stands in for an idle agent's TUI. Paints a footer once, waits for the pane to
 * settle, then repaints THE SAME BYTES at the same place, four times, spaced
 * wider than QUIET_MS. Nothing on the grid changes across those four repaints —
 * so nothing should ever read as "working".
 *
 * Save-cursor / move / write / restore-cursor is exactly the shape of the redraw
 * a TUI does on a timer.
 */
const REPAINT_PS1 = `
$e = [char]27
$frame = "$e[s$e[2;1Hidle footer - press esc to interrupt$e[u"
Write-Host -NoNewline $frame     # first paint: this DOES change the screen
Start-Sleep -Seconds 2           # let the pane settle to idle
for ($i = 0; $i -lt 12; $i++) {
  Write-Host -NoNewline $frame   # identical bytes, identical screen
  Start-Sleep -Milliseconds 1600
}
`

// The script must still be repainting while we sample — when it exits, the
// shell draws a fresh prompt, and THAT is a real screen change that legitimately
// reads as work. Sampling past the end would flag the app for doing its job.

app.whenReady().then(async () => {
  const win = BrowserWindow.getAllWindows()[0]
  if (win.webContents.isLoading()) {
    await new Promise((r) => win.webContents.once('did-finish-load', r))
  }
  win.focus()
  await sleep(2500)
  const wc = win.webContents
  const js = (src) => wc.executeJavaScript(src)

  const script = path.join(userData, 'repaint.ps1')
  fs.writeFileSync(script, REPAINT_PS1, 'utf8')

  await js(`document.querySelector('.ws-new').click(); true`)
  await sleep(2500)

  const dots = () =>
    js(`[...document.querySelectorAll('.tabbar .tab .dot')].map(d => d.className).join(' ')`)

  const type = async (text) => {
    await js(`(() => {
      const host = document.querySelector('.pane-slot:not(.hidden) .term-host');
      host.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      host.querySelector('.xterm-helper-textarea').focus();
      return true;
    })()`)
    await sleep(250)
    for (const ch of text) {
      wc.sendInputEvent({ type: 'char', keyCode: ch })
      await sleep(8)
    }
    wc.sendInputEvent({ type: 'keyDown', keyCode: 'Enter' })
    wc.sendInputEvent({ type: 'char', keyCode: '\r' })
    wc.sendInputEvent({ type: 'keyUp', keyCode: 'Enter' })
  }

  /* ---- 1. real output reads as work -------------------------------------- */

  await type(`powershell -NoProfile -File ${script}`)
  await sleep(1200)

  const during = await dots()
  if (!during.includes('dot-working')) {
    return fail(`output that changes the screen must read as working, got ${JSON.stringify(during)}`)
  }
  console.log('  output that changes the screen still reads as "working" ✓')

  /* ---- 2. identical repaints do NOT ------------------------------------- */

  // The script's first paint has landed; from here it only repaints the same
  // bytes. Wait out the settle, then watch across several repaint cycles.
  await sleep(3500)

  const settled = await dots()
  if (settled.includes('dot-working')) {
    return fail(`pane never settled after the first paint: ${JSON.stringify(settled)}`)
  }

  const samples = []
  for (let i = 0; i < 20; i++) {
    samples.push(await dots())
    await sleep(300)
  }

  const flickers = samples.filter((s) => s.includes('dot-working'))
  if (flickers.length > 0) {
    return fail(
      `an idle TUI repainting identical content flickered to "working" ` +
        `${flickers.length}/${samples.length} samples — this is the blue/green flicker`
    )
  }
  console.log(
    `  ${samples.length} samples across 4 identical repaints: never flickered to "working" ✓`
  )

  /* ---- 3. mark unread sticks while you're looking at the tab -------------- */

  const flagged = await js(`(async () => {
    document.querySelector('.tabbar .tab .tab-flag').click();
    await new Promise(r => setTimeout(r, 500));
    return {
      tabClass: document.querySelector('.tabbar .tab').className,
      dot: document.querySelector('.tabbar .tab .dot')?.className,
      badge: document.querySelector('.unseen-badge')?.textContent
    };
  })()`)

  if (!/\bunseen\b/.test(flagged.tabClass)) {
    return fail(`marking unread should light the tab, class is ${JSON.stringify(flagged.tabClass)}`)
  }
  if (!/dot-finished/.test(flagged.dot || '')) {
    return fail(`a flagged tab should show the green dot, got ${JSON.stringify(flagged.dot)}`)
  }
  console.log(`  marked a tab unread -> green dot + "${(flagged.badge || '').trim()}" ✓`)

  /*
   * The point of the feature: looking at the tab must NOT clear it. This IS the
   * active tab and the window has focus, so acknowledgeTab has already run over
   * it — and a focus event runs it again.
   */
  await js(`window.dispatchEvent(new Event('focus')); true`)
  await sleep(900)

  const stillLit = await js(`(() => ({
    tabClass: document.querySelector('.tabbar .tab').className,
    dot: document.querySelector('.tabbar .tab .dot')?.className
  }))()`)

  if (!/\bunseen\b/.test(stillLit.tabClass) || !/dot-finished/.test(stillLit.dot || '')) {
    return fail(
      `the flag must survive being looked at — that is the whole point; tab is now ${JSON.stringify(stillLit)}`
    )
  }
  console.log('  it stays lit while the tab is active and the window focused ✓')

  const cleared = await js(`(async () => {
    document.querySelector('.tabbar .tab .tab-flag').click();
    await new Promise(r => setTimeout(r, 500));
    return document.querySelector('.tabbar .tab').className;
  })()`)
  if (/\bunseen\b/.test(cleared)) {
    return fail(`clicking the dot again should clear the flag, class is ${cleared}`)
  }
  console.log('  clicking it again clears the flag ✓')

  /* ---- 4. a freshly-booted agent has not "finished" anything -------------- */

  /*
   * The dashboard's Claude is launched with a bare `claude` — no task. It boots,
   * paints its prompt and goes quiet, and that used to register as FINISHED:
   * the tab went green and the badge said "1 unchecked", in a pane where nothing
   * had ever been asked. Starting a REPL is not completing a job.
   *
   * The window is deliberately blurred first: "finished while you weren't
   * looking" is exactly the condition that marks a pane unseen, so this is the
   * case that used to fire.
   */
  await js(`window.dispatchEvent(new Event('blur')); true`)

  // Back to the dashboard (workspace 1), where the Claude pane lives.
  await js(`document.querySelectorAll('.ws')[0].click(); true`)
  await sleep(1000)
  await js(`document.querySelectorAll('.ws')[1].click(); true`) // look away from it
  await sleep(12000) // ...while it boots and settles

  const boot = await js(`(() => ({
    badge: document.querySelector('.unseen-badge')?.textContent?.trim() || '',
    litPanes: [...document.querySelectorAll('.pane')]
      .filter(p => /\\bunseen\\b/.test(p.className))
      .map(p => p.querySelector('.pane-title')?.textContent)
  }))()`)

  if (boot.litPanes.length > 0) {
    return fail(
      `an agent that was merely STARTED reported itself finished/unchecked: ` +
        `${JSON.stringify(boot.litPanes)} (badge: "${boot.badge}")`
    )
  }
  console.log('  a freshly-booted agent does not raise an unchecked notification ✓')

  /* ---- 5. typing is not working ------------------------------------------ */

  /*
   * Your own keystrokes echo back out of the PTY and change the screen, and an
   * agent's composer redraws its whole box around them. Taken at face value that
   * reads as work: the dot went blue the moment you started composing a message,
   * in a pane that had been done for ten minutes. Pressing Enter starts work —
   * typing does not.
   */
  await js(`document.querySelector('.tabbar .tab-new').click(); true`)
  await sleep(3500) // let the new shell boot, paint its prompt and settle

  const before = await dots()
  if (before.includes('dot-working')) {
    return fail(`new tab never settled before the typing test: ${JSON.stringify(before)}`)
  }

  await js(`(() => {
    const host = document.querySelector('.pane-slot:not(.hidden) .term-host');
    host.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    host.querySelector('.xterm-helper-textarea').focus();
    return true;
  })()`)
  await sleep(250)

  const typed = []
  for (const ch of 'write me a haiku about status dots') {
    wc.sendInputEvent({ type: 'char', keyCode: ch })
    await sleep(60) // slower than a person types, so any flicker has room to show
    typed.push(await dots())
  }

  const blue = typed.filter((s) => s.includes('dot-working'))
  if (blue.length > 0) {
    return fail(
      `composing a message read as "working" in ${blue.length}/${typed.length} samples — ` +
        `typing is not work`
    )
  }
  console.log(`  ${typed.length} keystrokes composed: the dot never went blue ✓`)

  console.log('STATUS PASS')
  app.exit(0)
})
