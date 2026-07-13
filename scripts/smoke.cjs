/**
 * End-to-end smoke test for the terminal hot path.
 *
 * Boots the real built app, then from inside the renderer: spawns a PTY through
 * the preload API, claims its transferred MessagePort, types a command into it,
 * and asserts the shell's output comes back over that same port.
 *
 * That covers ipcMain -> node-pty/ConPTY -> MessageChannelMain -> preload
 * re-post -> renderer, i.e. every hop a keystroke actually takes.
 *
 *   npm run build && npx electron scripts/smoke.cjs
 */
const { app, BrowserWindow } = require('electron')

require('../out/main/index.js')

const MARKER = 'SMOKE_OK_12345'
const cwd = process.env.USERPROFILE || process.env.HOME || process.cwd()

const fail = (msg) => {
  console.error(`SMOKE FAIL: ${msg}`)
  app.exit(1)
}

app.whenReady().then(async () => {
  // The app's own whenReady handler registered first, so its window exists.
  const win = BrowserWindow.getAllWindows()[0]
  if (!win) return fail('no BrowserWindow was created')

  if (win.webContents.isLoading()) {
    await new Promise((r) => win.webContents.once('did-finish-load', r))
  }

  setTimeout(() => fail('timed out after 30s'), 30_000)

  const script = `(async () => {
    const ports = new Map();
    const waiters = new Map();
    window.addEventListener('message', (e) => {
      if (e.source !== window) return;
      const d = e.data;
      if (!d || d.tag !== 'claudify:pty-port' || !d.id) return;
      const port = e.ports[0];
      const w = waiters.get(d.id);
      if (w) { waiters.delete(d.id); w(port); } else { ports.set(d.id, port); }
    });

    if (!window.claudify) return { ok: false, why: 'window.claudify missing (preload failed)' };

    const id = await window.claudify.createTerminal({
      cwd: ${JSON.stringify(cwd)}, cols: 80, rows: 24
    });

    const port = ports.get(id) || await new Promise((res, rej) => {
      waiters.set(id, res);
      setTimeout(() => rej(new Error('MessagePort never arrived for ' + id)), 10000);
    });

    let buf = '';
    port.onmessage = (e) => { if (typeof e.data === 'string') buf += e.data; };
    port.start();

    // Give the shell a moment to draw a prompt, then type into it for real.
    await new Promise((r) => setTimeout(r, 1500));
    port.postMessage('echo ${MARKER}\\r');

    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      // The echoed command line also contains the marker, so require it twice:
      // once as the echo of our keystrokes, once as the shell's actual output.
      if (buf.split('${MARKER}').length - 1 >= 2) {
        return { ok: true, id, bytes: buf.length };
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    return { ok: false, why: 'marker never came back', bytes: buf.length, tail: buf.slice(-400) };
  })()`

  let res
  try {
    res = await win.webContents.executeJavaScript(script)
  } catch (e) {
    return fail(`renderer threw: ${e.message}`)
  }

  if (!res || !res.ok) {
    return fail(`${res && res.why}\n--- tail ---\n${(res && res.tail) || ''}`)
  }

  console.log(`SMOKE PASS: pty=${res.id} round-tripped ${res.bytes} bytes through the MessagePort`)
  app.exit(0)
})
