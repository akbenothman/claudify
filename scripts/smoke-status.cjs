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

  console.log('STATUS PASS')
  app.exit(0)
})
