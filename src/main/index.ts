import { app, BrowserWindow, ipcMain, MessageChannelMain, dialog, shell } from 'electron'
import path from 'node:path'
import { createSession, killAll, killSession } from './pty'
import {
  commitAll,
  createWorktrees,
  diffForBranch,
  getRepoInfo,
  listWorktrees,
  mergeBranch,
  patchForBranch,
  removeWorktree
} from './git'
import { planSplit } from './split'
import { getSettings, loadState, saveSession, saveSessionNow, saveSettings } from './persist'
import { detectShells } from './shells'
import { dashboardPath, ensureDashboard, readDashboard, watchDashboard, writeDashboard } from './dashboard'
import type { Dashboard, PtySpawnOptions, Session, Settings, SplitTask } from '../shared/types'

// Must be set before anything reads app.getPath('userData'), or the session file
// lands in %APPDATA%\Electron in dev and somewhere else once packaged.
app.setName('Claudify')

/*
 * Deliberately NOT calling app.setAppUserModelId().
 *
 * Windows groups taskbar buttons by AppUserModelID. Setting an explicit one
 * here would only pay off if every shortcut carried the same ID — and we ship
 * unsigned, hand-made shortcuts rather than an NSIS installer that stamps it.
 * A window whose ID doesn't match the shortcut you pinned splits into a second,
 * un-pinnable taskbar button, which is the exact symptom we're fixing. With no
 * explicit ID, Windows derives one from the exe path, so the pinned shortcut and
 * the running window (both Claudify.exe) are one and the same button.
 */

// Terminals are latency-sensitive: a frame budget capped at the monitor refresh
// adds up to a frame of lag between keypress and glyph. Uncapping the renderer
// is the single cheapest input-latency win available to an Electron app.
app.commandLine.appendSwitch('disable-frame-rate-limit')
app.commandLine.appendSwitch('disable-renderer-backgrounding')

let win: BrowserWindow | null = null

/**
 * We ship unsigned, which means electron-builder never stamps the icon into the
 * exe itself (that step needs a code-signing toolchain we don't have). Handing
 * the icon to the window directly gets us the right taskbar and alt-tab icon
 * regardless.
 */
function iconPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'icon.ico')
    : path.join(__dirname, '../../build/icon.ico')
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 640,
    minHeight: 400,
    show: false,
    backgroundColor: '#0d1117',
    title: 'Claudify',
    icon: iconPath(),
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#0d1117', symbolColor: '#8b949e', height: 36 },
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      // Without this, Chromium throttles timers and rAF when the window is not
      // focused, which stalls output in background panes — exactly the panes
      // running long agent jobs that we want to keep watching.
      backgroundThrottling: false
    }
  })

  win.on('ready-to-show', () => win?.show())

  // Live-reload the dashboard when Claude (or anything else) edits the file.
  watchDashboard(win)

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

/* ------------------------------- PTY ---------------------------------- */

ipcMain.handle('pty:create', (event, opts: PtySpawnOptions) => {
  // One MessageChannel per terminal. The renderer keeps port2 and talks to the
  // PTY directly over it, so no keystroke is ever routed through ipcMain.
  const { port1, port2 } = new MessageChannelMain()
  const id = createSession(opts, port1)
  event.sender.postMessage('pty:port', { id }, [port2])
  return id
})

ipcMain.handle('pty:kill', (_e, id: string) => killSession(id))

/* ------------------------------- Git ---------------------------------- */

ipcMain.handle('git:info', (_e, cwd: string) => getRepoInfo(cwd))
ipcMain.handle('git:worktrees', (_e, repoRoot: string) => listWorktrees(repoRoot))

ipcMain.handle('git:diff', (_e, repoRoot: string, baseRef: string, branch: string) =>
  diffForBranch(repoRoot, baseRef, branch)
)

ipcMain.handle('git:patch', (_e, repoRoot: string, baseRef: string, branch: string) =>
  patchForBranch(repoRoot, baseRef, branch)
)

ipcMain.handle('git:merge', (_e, repoRoot: string, baseRef: string, branch: string) =>
  mergeBranch(repoRoot, baseRef, branch)
)

ipcMain.handle('git:commitAll', (_e, wtPath: string, message: string) => commitAll(wtPath, message))

ipcMain.handle('git:removeWorktree', (_e, repoRoot: string, wtPath: string, branch?: string) =>
  removeWorktree(repoRoot, wtPath, branch)
)

/* ------------------------------ Split --------------------------------- */

ipcMain.handle('split:plan', (_e, cwd: string, request: string) => planSplit(cwd, request))

ipcMain.handle(
  'split:createWorktrees',
  (_e, repoRoot: string, baseRef: string, tasks: SplitTask[]) =>
    createWorktrees(repoRoot, baseRef, tasks)
)

/* ------------------------------ Shell --------------------------------- */

ipcMain.handle('dialog:pickFolder', async () => {
  if (!win) return null
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
  return r.canceled ? null : r.filePaths[0]
})

ipcMain.handle('app:home', () => app.getPath('home'))

/* ---------------------------- state / settings ---------------------------- */

ipcMain.handle('state:load', () => loadState())
ipcMain.handle('session:save', (_e, session: Session) => saveSession(session))
ipcMain.on('session:save-now', (e, session: Session) => {
  saveSessionNow(session)
  e.returnValue = true
})
ipcMain.handle('settings:save', (_e, patch: Partial<Settings>) => saveSettings(patch))
ipcMain.handle('settings:get', () => getSettings())
ipcMain.handle('shells:detect', () => detectShells())

/* ------------------------------- dashboard -------------------------------- */

ipcMain.handle('dashboard:get', () => {
  ensureDashboard()
  return readDashboard()
})
ipcMain.handle('dashboard:save', (_e, data: Dashboard) => writeDashboard(data))
ipcMain.handle('dashboard:path', () => dashboardPath())

/* ----------------------------- Lifecycle ------------------------------- */

app.whenReady().then(createWindow)

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

app.on('window-all-closed', () => {
  killAll()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', killAll)
