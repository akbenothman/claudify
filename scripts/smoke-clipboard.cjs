/**
 * Copy and paste inside a terminal pane.
 *
 * xterm treats Ctrl+V as the VT100 key it historically is: it maps to \x16,
 * cancels the event, and so the browser's native paste never runs — the pane
 * received a raw control character and the clipboard never arrived. (Before the
 * fix, this test's shell echoed a literal `^V` at its prompt.) Panes therefore
 * do the clipboard themselves, and this guards that:
 *
 *   1. Ctrl+V pastes the clipboard into the pane.
 *   2. Ctrl+Shift+V does too — the muscle memory other terminals train.
 *   3. Ctrl+C is still SIGINT, not copy. It is the only way to stop a runaway
 *      agent, so a regression here matters more than the paste itself.
 *
 * The pasted text is observed through the serialized scrollback rather than the
 * DOM: panes render through WebGL onto a canvas, so the text is not in the DOM
 * to be read.
 *
 *   npm run build && npx electron scripts/smoke-clipboard.cjs
 */
const { app, BrowserWindow, clipboard } = require('electron')
const fs = require('node:fs')

const { stateFile } = require('./sandbox.cjs')('clipboard')
if (fs.existsSync(stateFile)) fs.rmSync(stateFile)

require('../out/main/index.js')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fail = (msg) => {
  console.error(`CLIPBOARD FAIL: ${msg}`)
  app.exit(1)
}

const PASTE_ONE = 'PASTED_ONE_A1B2C3'
const PASTE_TWO = 'PASTED_TWO_D4E5F6'

/** Every terminal pane's saved scrollback, flattened. */
const allScrollback = () => {
  if (!fs.existsSync(stateFile)) return []
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

const dump = (buffers) =>
  buffers.forEach((b, i) => {
    const plain = b.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '').replace(/\s+/g, ' ')
    console.error(`    buffer[${i}]: ${JSON.stringify(plain.slice(-140))}`)
  })

app.whenReady().then(async () => {
  const win = BrowserWindow.getAllWindows()[0]
  const wc = win.webContents
  if (wc.isLoading()) await new Promise((r) => wc.once('did-finish-load', r))
  setTimeout(() => fail('timed out after 90s'), 90_000)
  win.show()
  win.focus()
  wc.focus()
  await sleep(3000)

  /*
   * A new workspace's first tab runs Claude — a TUI, which doesn't echo what you
   * type. A new *tab* carries no command, so it's a plain shell, and a shell
   * echoes a paste straight back at its prompt where the serializer can see it.
   */
  await wc.executeJavaScript(`document.querySelector('.ws-new').click(); true`)
  await sleep(3000)
  await wc.executeJavaScript(`document.querySelector('.tab-new').click(); true`)
  await sleep(4000)

  /*
   * A synthetic KeyboardEvent cannot trigger Chromium's native paste — but the
   * pane doesn't rely on it: it reads the clipboard itself from its keydown
   * handler. Dispatching on the textarea xterm listens to is exactly the path a
   * real Ctrl+V takes into that handler.
   */
  const press = (key, { shift = false } = {}) =>
    wc.executeJavaScript(`(() => {
      const ta = document.querySelector('.pane-slot:not(.hidden) .xterm-helper-textarea');
      if (!ta) return '(no terminal)';
      ta.focus();
      ta.dispatchEvent(new KeyboardEvent('keydown', {
        key: ${JSON.stringify(key)},
        code: 'Key' + ${JSON.stringify(key.toUpperCase())},
        keyCode: ${key.toUpperCase().charCodeAt(0)},
        which: ${key.toUpperCase().charCodeAt(0)},
        ctrlKey: true, shiftKey: ${shift},
        bubbles: true, cancelable: true
      }));
      return document.activeElement.className;
    })()`)

  // --- 1. Ctrl+V ----------------------------------------------------------
  clipboard.writeText(PASTE_ONE)
  const focus = await press('v')
  if (!/xterm-helper-textarea/.test(focus)) return fail(`could not focus a terminal (${focus})`)

  /*
   * --- 2. Ctrl+C, between the two pastes ---------------------------------
   * The shell echoes `^C` when it takes an interrupt, which is the only proof
   * from out here that \x03 actually arrived. It also abandons the line the
   * paste above is sitting on, leaving a clean prompt for the next one.
   */
  await sleep(600)
  await press('c')

  // --- 3. Ctrl+Shift+V ----------------------------------------------------
  await sleep(600)
  clipboard.writeText(PASTE_TWO)
  await press('V', { shift: true })

  // The periodic sweep (10s) is what captures terminal output into the state;
  // terminal bytes never touch the store, so nothing else would trip a save.
  await sleep(12_000)

  const buffers = allScrollback()
  if (buffers.length === 0) return fail('no scrollback was saved at all')

  const pastedOne = buffers.some((b) => b.includes(PASTE_ONE))
  const pastedTwo = buffers.some((b) => b.includes(PASTE_TWO))

  if (!pastedOne) {
    dump(buffers)
    return fail('Ctrl+V did not paste the clipboard into the pane (a literal ^V means xterm ate it)')
  }
  console.log('  Ctrl+V pastes the clipboard into a pane ✓')

  if (!pastedTwo) {
    dump(buffers)
    return fail('Ctrl+Shift+V did not paste the clipboard into the pane')
  }
  console.log('  Ctrl+Shift+V pastes too ✓')

  /*
   * Ctrl+C must still interrupt — hijacking it for copy would leave no way to
   * stop a runaway agent, which is worse than never being able to paste.
   *
   * The proof available from out here is the prompt: nothing ever pressed
   * Enter, so the only thing that can abandon the line holding the first paste
   * and start a fresh prompt before the second is \x03 reaching the shell.
   * (ConPTY's cmd doesn't echo a literal ^C, so there's no marker to grep for.)
   */
  const interrupted = buffers.some((b) => {
    const plain = b.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '')
    return new RegExp(`${PASTE_ONE}[\\s\\S]*>[\\s\\S]*${PASTE_TWO}`).test(plain)
  })
  if (!interrupted) {
    dump(buffers)
    return fail(
      'Ctrl+C did not interrupt: no fresh prompt between the two pastes, so \\x03 never ' +
        'reached the shell. It must not be rebound to copy.'
    )
  }
  console.log('  Ctrl+C still interrupts the shell (SIGINT, not copy) ✓')

  console.log('CLIPBOARD PASS')
  app.exit(0)
})
