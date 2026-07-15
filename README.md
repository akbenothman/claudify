# claudify

A terminal built for Claude. Workspaces, split panes, and **git-worktree task splitting** —
give it one prompt, get N isolated worktrees each running their own agent, and a merge view
to land the results.

Windows first. macOS is [tracked in TODO.md](TODO.md), not built yet.

> Status: v0.1, early. The terminal, workspaces, splits and the worktree engine all work
> and are covered by end-to-end smoke tests. Everything in TODO.md is not built.

---

## The idea

Running several coding agents at once is usually a mess: they fight over the same files,
and you end up babysitting `git stash`. The fix is one worktree per task — a real,
isolated checkout on its own branch. claudify makes that a single keystroke.

```
Ctrl+Shift+S  →  "add dark mode, fix the auth refresh bug, write parser tests"

  ┌ claudify/dark-mode ─┬ claudify/auth-fix ──┐
  │ claude …            │ claude …            │
  ├─────────────────────┼─────────────────────┤
  │ claudify/parser-…   │  MERGE              │
  │ claude …            │  +212 −18, 3 files  │
  └─────────────────────┴─────────────────────┘
```

A planner Claude decomposes the request into tasks that *don't touch the same files*.
Each task gets `git worktree add -b claudify/<slug>`, its own pane, and its own Claude
started on just that task. The merge pane commits, diffs and merges each branch back.

You review the plan before anything is created — nothing is branched or launched until
you press **launch**.

## Features

- **Workspaces → tabs → split panes** (the wezterm model). Sidebar of workspaces, a tab bar
  per workspace, recursive splits with draggable dividers and zoom.
- **Worktree splitting** — the headline feature above. New worktrees are **seeded to
  build**: `node_modules` (and other declared dirs) are junctioned in, `.env` files copied,
  so an agent isn't stuck on a five-minute install before it can do anything. The merge pane
  now **runs each worktree's tests** and badges it green/red, **pre-flights the merges** to
  tell you which branches actually conflict (the planner only *claims* they don't), and lets
  you **adopt work hunk by hunk** instead of all-or-nothing.
- **Live cost & status.** Each agent pane reads Claude Code's own session transcript
  (`~/.claude/projects/**`) — so its working/finished/**blocked** state is exact rather than
  guessed, a pane waiting on a permission prompt is flagged amber, and every pane shows a
  running **token + cost meter**.
- **Control surface.** The dashboard's "it's just a file every agent can edit" bet, extended
  to the whole app. An agent writes to `control.json` to raise a desktop notification, set a
  pane's status, type into another pane, or bring one on screen — no MCP, no shim.
- **AK Dashboard** — a permanent first workspace: small terminal, a always-on Claude, a todo
  list and a conversation tracker. Claude can change the status of anything on it (see below).
- **Fast input.** Keystrokes never touch React or `ipcRenderer` — see below.
- **Smart pane names.** A pane names itself from what you run in it (`npm run dev` → "npm dev").
  Once an agent CLI is running there, it names itself from the *topic* instead
  ("can you add dark mode" → "claude: add dark mode"). Rename by hand and it stops guessing.
- **Working / finished / unchecked.** A calm blue pulse while output flows; a solid green dot
  when an agent finished **and you haven't looked**; a quiet hollow ring once you have. "Looked"
  means the pane was actually on screen *and* the window had focus — something finishing while
  you're in another app stays flagged.
- **Drag and drop.** Reorder tabs, drag a tab onto a workspace to move it there, or drop a tab
  onto a pane to combine them into a split. Dragged panes keep running (see Architecture).
- **Session persistence.** Workspaces, tabs, layouts, names and cwds survive a restart.
- **Pick your shell.** Defaults to Command Prompt; the ⚙ gear lists whatever you have installed
  (PowerShell, Git Bash, WSL, Nushell…).
- **Panes keep running.** Switching workspace, zooming, or dragging a tab never unmounts a pane,
  so you can't accidentally kill a long agent job.

## The AK Dashboard

Workspace 1 is permanent and can't be deleted. It carries a notepad, a Claude REPL, a todo
list, a conversation tracker, and — on its own tab — a **calendar** that shows your upcoming
Google Calendar events and lets you add or delete them. The calendar works exactly like the
rest of the dashboard: the app reads `calendar.json`, and an agent with the Google Calendar
MCP fills it and fulfils the add/delete requests the pane writes. Claudify never talks to
Google itself.

Claude changes the status of things by **editing a plain JSON file** —
`%APPDATA%\Claudify\dashboard.json`. That's the whole protocol: no MCP server, no CLI shim, just
a file every agent already has tools for. The app watches it and re-renders live, so telling the
dashboard's Claude *"mark the auth todo blocked"* updates the UI without a reload. The file
carries its own schema instructions, and the tracker pane shows you the path.

The dashboard's Claude pane restarts with the app (it only opens the REPL). Worktree task panes
deliberately do **not** — rebooting your PC must never silently re-run a real task.

## Keybindings

| Key | Action |
| --- | --- |
| `Ctrl+Shift+S` | **Split into worktrees** (the big one) |
| `Ctrl+T` | New tab |
| `Ctrl+Shift+N` | New workspace |
| `Ctrl+Shift+D` | Split pane right |
| `Ctrl+Shift+E` | Split pane down |
| `Ctrl+Shift+W` | Close pane (closes the tab if it's the last one) |
| `Ctrl+Shift+Enter` | Zoom pane |
| `Ctrl+Shift+1..9` | Jump to workspace |

Double-click or right-click a workspace or tab to rename it; right-click a workspace to delete it.

## Why input is fast

The usual Electron terminal routes every keystroke through `ipcRenderer` → the main
process IPC router → back again, often re-rendering React on the way. claudify doesn't.

On spawn, the main process creates a `MessageChannelMain` and transfers one end to the
renderer. After that, the terminal talks **directly** to its PTY:

```
keypress → xterm.onData → MessagePort → node-pty (ConPTY) → shell
shell    → node-pty     → MessagePort → xterm.write
```

No React render, no IPC router, no main-process hop. On top of that:

- **WebGL renderer** (`@xterm/addon-webgl`) so heavy output stays smooth.
- `disable-frame-rate-limit` — a vsync-capped renderer adds up to a frame of lag.
- `backgroundThrottling: false` so background panes running agents don't stall.
- `smoothScrollDuration: 0` — scroll animation is pure added latency.

Honest caveat: this is a *good* architecture, but the actual latency is **unmeasured**.
It will not beat a native GPU terminal like WezTerm or Alacritty, which have no web layer
at all. Measuring it is in TODO.md.

## Install

Requires Node 20+, git, and (for splitting) the [`claude` CLI](https://claude.com/claude-code)
on your `PATH`.

```bash
git clone https://github.com/akbenothman/claudify
cd claudify
npm install
npm run dev
```

Build a Windows installer:

```bash
npm run pack:win     # → release/
```

There's no native compilation step — `@lydell/node-pty` ships prebuilt ConPTY binaries,
so you don't need Visual Studio Build Tools.

## How the split works

1. Your request is piped to `claude -p` (over **stdin**, never argv — on Windows `claude`
   is a `.cmd` shim that must be launched through a shell, and user text on a `cmd.exe`
   command line is a command-injection hazard).
2. It returns a JSON array of independent tasks. You review and edit them.
3. Each task gets a worktree in `../.claudify-worktrees/<repo>/<slug>` — a *sibling*
   directory, so the worktrees never pollute `git status`, ripgrep, or your build globs.
4. Each pane launches `claude "<that task's prompt>"` in its worktree.
5. The merge pane runs `git diff base...branch` per task and merges them back one at a time.

If the `claude` CLI isn't reachable, the planner degrades to a literal line-by-line split
and tells you it did — the feature still works if you enumerate the tasks yourself.

## Tests

```bash
npm test
```

Five end-to-end suites, all driving the real app — no mocks:

- `smoke.cjs` — spawns a PTY through the real preload API, claims its transferred
  MessagePort, types into the shell and asserts the output comes back. Covers every hop
  a keystroke actually takes.
- `smoke-worktree.cjs` — builds a throwaway repo, creates worktrees, simulates an agent
  editing files, then commits/diffs/merges and asserts the change lands on `main`.
- `smoke-dnd.cjs` — drags a tab to another workspace and combines two tabs into a split,
  asserting the terminal's **DOM node survives both** (a remount would kill its PTY).
- `smoke-dashboard.cjs` — edits `dashboard.json` from outside the app, exactly as Claude's
  file tools would, and asserts the UI live-updates.
- `smoke-calendar.cjs` — writes an event to `calendar.json` and asserts it renders, then adds
  and deletes one through the UI and asserts the requests land in the file.
- `smoke-control.cjs` — writes requests to `control.json` (as an agent would) and asserts the
  visible effect **and** the result recorded back into the file.
- `smoke-bootstrap.cjs` — creates a worktree in a repo with `node_modules` + `.env` and
  asserts both were seeded into the fresh checkout.
- `smoke-session.cjs` — mutates a session, then **cold-starts a second process** and asserts
  the workspaces came back.

## Architecture

```
src/
  main/
    index.ts     Electron main, window, IPC surface
    pty.ts       node-pty/ConPTY + the MessagePort fast path
    git.ts       worktree create/list/diff/merge/remove
    split.ts     the planner Claude + JSON extraction + degraded fallback
    persist.ts   session + settings, atomically written
    shells.ts    detects the shells you actually have installed
    dashboard.ts the watched dashboard.json (Claude's control surface)
    calendar.ts  the watched calendar.json (Google Calendar via an MCP agent)
    control.ts   the watched control.json (agents drive the terminal)
    transcript.ts reads ~/.claude/projects/** for live status + token/cost
  preload/
    index.ts     contextBridge API; re-posts MessagePorts into the main world
                 (a MessagePort cannot cross contextBridge — this is Electron's
                  supported route)
  renderer/src/
    store.ts            zustand: workspaces → tabs → panes + layout trees
    layout.ts           flattens a split tree into absolute rectangles
    titles.ts           smart pane naming (command / topic heuristics)
    ptyPorts.ts         claims transferred ports by pty id
    components/
      Stage.tsx         ALL panes, flat, absolutely positioned (see below)
      TerminalPane.tsx  xterm + WebGL, binds straight to the port
      SplitDialog.tsx   plan → review → launch
      MergeView.tsx     commit / diff / merge / discard
      TodoPane.tsx      dashboard todo list
      TrackerPane.tsx   dashboard conversation tracker
      CalendarPane.tsx  dashboard calendar (reads/writes calendar.json)
```

### Why panes are rendered flat

`Stage.tsx` renders every pane of every tab of every workspace as **one flat keyed list** of
absolutely-positioned siblings, with rectangles computed from the layout tree — rather than as
nested DOM inside per-tab wrappers.

This is not cosmetic. If panes were nested, dragging a tab to another workspace would move its
panes between two different React sibling lists, and React would unmount and remount them:
**PTY destroyed, agent killed**. In one flat list keyed by pane id, a move is just a reorder, so
React relocates the existing DOM node and the process inside it never notices. `smoke-dnd.cjs`
exists specifically to keep that true.

## Prior art

- [cmux](https://github.com/manaflow-ai/cmux) — native macOS (Swift + libghostty). The
  attention-ring and agent-notification ideas come from here.
- [wmux](https://github.com/amirlehmam/wmux) — the Windows cmux port; same
  Electron + xterm + ConPTY foundation. It has no worktree support, which is the gap
  claudify exists to fill.
- [WezTerm](https://github.com/wezterm/wezterm) — Rust + wgpu. The bar for what "fast"
  actually means.

## License

MIT
