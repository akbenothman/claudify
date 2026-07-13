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

- **Workspaces** with recursive split panes (tmux/wezterm-style tree), draggable dividers, zoom.
- **Fast input.** Keystrokes never touch React or `ipcRenderer` — see below.
- **Worktree splitting** — the headline feature above.
- **Attention rings.** A pane that wants you glows blue, and so does its workspace tab.
  Raised by OSC 9 / OSC 777 / bell, which is what agent CLIs already emit. (Borrowed from cmux.)
- **Panes keep running.** Switching workspace or zooming never unmounts a pane, so you
  never accidentally kill a long agent job.

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

## Keybindings

| Key | Action |
| --- | --- |
| `Ctrl+Shift+S` | **Split into worktrees** (the big one) |
| `Ctrl+Shift+T` | New workspace |
| `Ctrl+Shift+D` | Split pane right |
| `Ctrl+Shift+E` | Split pane down |
| `Ctrl+Shift+W` | Close pane |
| `Ctrl+Shift+Enter` | Zoom pane |
| `Ctrl+Shift+1..9` | Jump to workspace |

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

Two end-to-end smoke tests, both driving the real app:

- `smoke.cjs` — spawns a PTY through the real preload API, claims its transferred
  MessagePort, types into the shell and asserts the output comes back. Covers every hop
  a keystroke actually takes.
- `smoke-worktree.cjs` — builds a throwaway repo, creates worktrees, simulates an agent
  editing files, then commits/diffs/merges and asserts the change lands on `main`.

## Architecture

```
src/
  main/
    index.ts    Electron main, window, IPC surface
    pty.ts      node-pty/ConPTY + the MessagePort fast path
    git.ts      worktree create/list/diff/merge/remove
    split.ts    the planner Claude + JSON extraction + degraded fallback
  preload/
    index.ts    contextBridge API; re-posts MessagePorts into the main world
                (a MessagePort cannot cross contextBridge — this is Electron's
                 supported route)
  renderer/src/
    store.ts            zustand: workspaces + recursive layout tree
    ptyPorts.ts         claims transferred ports by pty id
    components/
      TerminalPane.tsx  xterm + WebGL, binds straight to the port
      SplitTree.tsx     recursive layout + draggable dividers
      SplitDialog.tsx   plan → review → launch
      MergeView.tsx     commit / diff / merge / discard
```

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
