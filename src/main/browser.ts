import { WebContentsView, type BrowserWindow } from 'electron'

/**
 * A single Chromium page claudify owns and Claude drives.
 *
 * This is the one place claudify breaks its "just a file" rule: a live browser
 * needs a live channel, so it can't be driven through JSON. We reuse Electron's
 * own bundled Chromium via a `WebContentsView` — no second browser to install.
 *
 * There is exactly one browser. When a browser pane is on screen the view is
 * shown inside it; the rest of the time the page stays alive but hidden, so
 * Claude's session (cookies, scroll, the page it's on) survives closing the
 * pane. The MCP server drives it whether or not a pane exists.
 */

let win: BrowserWindow | null = null
let view: WebContentsView | null = null
/** The pane currently displaying the view, if any. */
let attachedPane: string | null = null

export function initBrowser(w: BrowserWindow): void {
  win = w
}

/** Lazily create the view. Kept hidden until a pane attaches it. */
function ensureView(): WebContentsView {
  if (view) return view
  if (!win) throw new Error('browser used before the window exists')
  view = new WebContentsView({
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false }
  })
  win.contentView.addChildView(view)
  view.setVisible(false)
  // Open target=_blank links in the same view rather than spawning windows we
  // don't manage.
  view.webContents.setWindowOpenHandler(({ url }) => {
    view?.webContents.loadURL(url).catch(() => {})
    return { action: 'deny' }
  })
  return view
}

const wc = () => ensureView().webContents

/* ----------------------------- pane placement ----------------------------- */

/** A browser pane reports its on-screen rectangle; show the view there. */
export function attachBrowser(paneId: string, bounds: Electron.Rectangle): void {
  const v = ensureView()
  attachedPane = paneId
  v.setBounds(bounds)
  v.setVisible(true)
}

/** Keep the view aligned with its pane as the layout moves. */
export function setBrowserBounds(paneId: string, bounds: Electron.Rectangle): void {
  if (attachedPane !== paneId || !view) return
  view.setBounds(bounds)
}

/** The pane went off screen or closed: hide the view, keep the page alive. */
export function detachBrowser(paneId: string): void {
  if (attachedPane !== paneId) return
  attachedPane = null
  view?.setVisible(false)
}

/* ------------------------------ driving it -------------------------------- */

export interface BrowserInfo {
  url: string
  title: string
}

function info(): BrowserInfo {
  const c = wc()
  return { url: c.getURL(), title: c.getTitle() }
}

/** Navigate and wait for the load to actually settle. */
export async function navigate(url: string): Promise<BrowserInfo> {
  const target =
    /^[a-z]+:\/\//i.test(url) || url.startsWith('about:') || url.startsWith('data:')
      ? url
      : `https://${url}`
  const c = wc()
  // Wait on the real load events rather than loadURL's promise: for data: URLs
  // and cross-navigations the promise resolves/rejects unreliably, but
  // did-finish-load / did-fail-load are dependable.
  await new Promise<void>((resolve) => {
    const done = (): void => {
      clearTimeout(timer)
      c.off('did-finish-load', done)
      c.off('did-fail-load', onFail)
      resolve()
    }
    const onFail = (_e: unknown, code: number): void => {
      // ERR_ABORTED (-3) fires when a newer navigation supersedes this one; the
      // page still ends up somewhere, so treat it like a finish.
      if (code === -3) return
      done()
    }
    const timer = setTimeout(done, 15_000)
    c.once('did-finish-load', done)
    c.on('did-fail-load', onFail)
    c.loadURL(target).catch(() => {})
  })
  return info()
}

/** Run arbitrary JS in the page and return the (serialisable) result. */
export async function evaluate(expression: string): Promise<unknown> {
  return wc().executeJavaScript(expression, true)
}

/**
 * A text snapshot of the page for Claude to "look at": title, url, the visible
 * text, and the interactive elements with selectors it can act on.
 */
export async function snapshot(): Promise<string> {
  const { url, title } = info()
  const body = (await wc()
    .executeJavaScript(
      `(() => {
        const text = (document.body?.innerText || '').replace(/\\n{3,}/g, '\\n\\n').trim().slice(0, 6000);
        const els = [...document.querySelectorAll('a,button,input,textarea,select,[role=button]')]
          .slice(0, 60)
          .map((e, i) => {
            const label = (e.innerText || e.value || e.placeholder || e.getAttribute('aria-label') || '').trim().slice(0, 60);
            const sel = e.id ? '#' + CSS.escape(e.id) : e.tagName.toLowerCase() + ':nth-of-type(' + ([...document.getElementsByTagName(e.tagName)].indexOf(e) + 1) + ')';
            return label ? '- ' + e.tagName.toLowerCase() + ' "' + label + '"  [' + sel + ']' : '';
          })
          .filter(Boolean)
          .join('\\n');
        return text + '\\n\\n--- interactive ---\\n' + els;
      })()`,
      true
    )
    .catch(() => '')) as string
  return `# ${title}\n${url}\n\n${body}`
}

/** A PNG screenshot as a base64 data string (no data: prefix). */
export async function screenshot(): Promise<string> {
  const img = await wc().capturePage()
  return img.toPNG().toString('base64')
}

/** Click the first element matching a CSS selector. */
export async function click(selector: string): Promise<BrowserInfo> {
  await wc().executeJavaScript(
    `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw new Error('no element matches ${selector.replace(/'/g, "\\'")}'); el.click(); })()`,
    true
  )
  return info()
}

export async function goBack(): Promise<BrowserInfo> {
  const nav = wc().navigationHistory
  if (nav.canGoBack()) nav.goBack()
  return info()
}

export async function reload(): Promise<BrowserInfo> {
  wc().reload()
  return info()
}

export function currentInfo(): BrowserInfo {
  return info()
}

export function destroyBrowser(): void {
  if (view && win) {
    try {
      win.contentView.removeChildView(view)
    } catch {
      /* window already gone */
    }
  }
  view = null
  attachedPane = null
}
