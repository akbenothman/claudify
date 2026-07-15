# TODO

## macOS support (tracked, not started)

Windows is the target for v1. Nothing in the design blocks macOS, but these are the
known touch points:

- [ ] **PTY**: `@lydell/node-pty` ships darwin arm64/x64 prebuilds, so this should be a
      no-op. `src/main/shells.ts` already has a POSIX candidate list (zsh/bash/sh) —
      verify detection actually works on a Mac.
- [ ] **Title bar**: `titleBarStyle: 'hidden'` + `titleBarOverlay` is Windows/Linux only.
      macOS needs `trafficLightPosition` and the `.titlebar-right` margin (which is
      currently reserving 140px for the Windows caption buttons) has to flip to the left.
- [ ] **Keybindings**: `Ctrl+Shift+*` should become `Cmd+Shift+*`. The handler in
      `App.tsx` checks `e.ctrlKey` directly; needs a platform-aware modifier.
- [ ] **Packaging**: add a `mac` target (dmg + zip), plus notarization/codesigning.
      Note the Windows side ships unsigned: `npm run pack:win` (NSIS) currently fails
      because electron-builder's winCodeSign bundle contains macOS symlinks, and
      unpacking those needs admin or Developer Mode. `npm run pack:dir` sidesteps it
      (`signAndEditExecutable: false`), at the cost of the exe carrying Electron's
      own icon/metadata — the window icon is set at runtime instead.
- [ ] **CI**: add a macOS runner to the build matrix.

## Terminal

- [x] Persist workspace + pane layout across restarts (respawn shells in saved cwds).
- [x] Shell selection (cmd / PowerShell / Git Bash / WSL / Nushell).
- [x] Smart pane naming from commands and agent topics.
- [x] Drag tabs to reorder, move between workspaces, or combine into a split.
- [ ] Scrollback search (`@xterm/addon-search`).
- [ ] Copy-on-select and a proper right-click paste.
- [ ] Configurable font / theme / keybindings.
- [ ] Pane navigation by direction (Ctrl+Shift+Arrow), not just close/zoom.
- [ ] `Ctrl+Shift+P` command palette.
- [x] Restore scrollback on session restore. The buffer is snapshotted with
      `@xterm/addon-serialize` and replayed at mount. It has to be scrolled up into
      the scrollback buffer first, because ConPTY opens a new shell with `ESC[2J`
      and would otherwise wipe it off the screen.

## Dashboard

- [x] Permanent AK Dashboard workspace (terminal + Claude + todos + conversation tracker).
- [x] Claude controls it by editing `dashboard.json`; the app watches the file.
- [x] Calendar tab — reads `calendar.json` (filled by an agent via the Google Calendar
      MCP), shows upcoming events, and writes add/delete requests back.
- [ ] Auto-populate the conversation tracker from real Claude Code sessions
      (`~/.claude/projects/**`) instead of only manual/agent entries. (The reader
      exists now — `transcript.ts` — it just isn't wired to the tracker yet.)
- [ ] Toast / taskbar flash *automatically* when a pane finishes in the background.
      (The mechanism exists — `control.ts`'s `notify` — an agent can already raise
      one; doing it on every finish without being asked is the missing part.)

## Worktree splitting

- [x] Full patch view in the merge pane — the "adopt hunks" panel parses `git:patch`
      into files/hunks and lets you apply a subset to the base working tree.
- [x] Seed a fresh worktree so it can build — junction `node_modules`/declared dirs,
      copy `.env`, run optional post-create hooks (config: `claudify.worktree.json`).
- [x] Run each worktree's test command from the merge pane and badge it green/red.
- [x] Merge pre-flight: dry-run pairwise merges and warn which branches actually
      conflict before you merge (the planner only *claims* they don't).
- [ ] Dependency-aware waves: let the planner mark task B as depending on task A and
      run them in order instead of all at once (cmux/wmux do this).
- [ ] Auto-commit an agent's work when its pane goes idle, so the merge view is
      never stale.
- [ ] Reviewer agent that reads the combined diff and proposes fixes.
- [ ] Conflict *resolution* UI instead of `merge --abort` (pre-flight *detection*
      is done; resolving them in-app is not).
- [ ] "Adopt existing worktrees" — reattach panes to worktrees from a previous session.

## Agent awareness

- [x] Read Claude Code transcripts (`~/.claude/projects/**`) for exact working /
      finished / **blocked** status and a per-pane token + cost meter (`transcript.ts`).
- [x] Control surface: agents drive the terminal (notify / set pane status / type into
      a pane / focus a pane) by editing `control.json` (`control.ts`).
- [ ] Broadcast input — type once, send to every agent pane. The plumbing is in place
      (`paneInput.ts` already registers a writer per pane); just needs a keybinding.
- [ ] Race mode — run one prompt in N worktrees with different agents and keep the winner.

## Performance

- [ ] Measure real input latency (typometer or a high-speed capture) rather than
      trusting the architecture. Current design removes React and `ipcRenderer` from
      the keystroke path, but this is unmeasured.
- [ ] Consider a binary (`Uint8Array`) transport over the MessagePort instead of
      strings to skip a UTF-16 conversion per chunk.
