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
import type { PtySpawnOptions, SplitTask } from '../shared/types'

// Terminals are latency-sensitive: a frame budget capped at the monitor refresh
// adds up to a frame of lag between keypress and glyph. Uncapping the renderer
// is the single cheapest input-latency win available to an Electron app.
app.commandLine.appendSwitch('disable-frame-rate-limit')
app.commandLine.appendSwitch('disable-renderer-backgrounding')

let win: BrowserWindow | null = null

function createWindow(): void {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 640,
    minHeight: 400,
    show: false,
    backgroundColor: '#0d1117',
    title: 'Claudify',
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
