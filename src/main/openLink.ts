import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { shell } from 'electron'

/**
 * Open a link the user clicked inside claudify in a real browser.
 *
 * We can't just trust `shell.openExternal`: if Windows has no healthy default
 * browser association (common — it gets reset, or points at a broken handler)
 * an `http(s)` URL falls through to the "look for an app in the Store" prompt
 * instead of a page. So we open Chrome by name explicitly and only fall back to
 * the OS default when Chrome genuinely isn't installed. Non-web links (mailto:,
 * custom schemes) always go to the OS handler — that's what they're for.
 */

const CHROME_CANDIDATES = [
  path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'Google\\Chrome\\Application\\chrome.exe'),
  path.join(
    process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
    'Google\\Chrome\\Application\\chrome.exe'
  ),
  path.join(process.env['LOCALAPPDATA'] || '', 'Google\\Chrome\\Application\\chrome.exe')
]

let cachedChrome: string | null | undefined
function findChrome(): string | null {
  if (cachedChrome !== undefined) return cachedChrome
  cachedChrome = CHROME_CANDIDATES.find((p) => p && existsSync(p)) ?? null
  return cachedChrome
}

/** A bare host like `github.com/foo` that a user plainly meant as a web link. */
const looksLikeDomain = (s: string): boolean => /^[\w-]+(\.[\w-]+)+([/:?#]|$)/.test(s)

/**
 * Schemes that mean something only inside a browser engine. Handing one to
 * Windows finds no association and pops the "get an app from the Store" dialog,
 * so we drop them instead of routing them out.
 */
const INTERNAL_SCHEME = /^(about|blob|data|javascript|chrome|devtools):/i

export function openLink(rawUrl: string): void {
  const url = (rawUrl || '').trim()
  if (!url) return
  if (INTERNAL_SCHEME.test(url)) return

  const isWeb = /^https?:\/\//i.test(url)
  const target = isWeb ? url : looksLikeDomain(url) ? `https://${url}` : null

  // Not a web page (mailto:, vscode:, file:, …) — let the OS route it.
  if (!target) {
    shell.openExternal(url).catch(() => {})
    return
  }

  const chrome = findChrome()
  if (chrome) {
    try {
      spawn(chrome, [target], { detached: true, stdio: 'ignore' }).unref()
      return
    } catch {
      /* Chrome vanished between the check and the spawn — fall back below. */
    }
  }
  shell.openExternal(target).catch(() => {})
}
