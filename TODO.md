# TODO

## macOS support (tracked, not started)

Windows is the target for v1. Nothing in the design blocks macOS, but these are the
known touch points:

- [ ] **PTY**: `@lydell/node-pty` ships darwin arm64/x64 prebuilds, so this should be a
      no-op — but `defaultShell()` in `src/main/pty.ts` currently hard-codes the
      PowerShell lookup on the non-win32 path to `$SHELL`. Verify against zsh.
- [ ] **Title bar**: `titleBarStyle: 'hidden'` + `titleBarOverlay` is Windows/Linux only.
      macOS needs `trafficLightPosition` and the `.titlebar-right` margin (which is
      currently reserving 140px for the Windows caption buttons) has to flip to the left.
- [ ] **Keybindings**: `Ctrl+Shift+*` should become `Cmd+Shift+*`. The handler in
      `App.tsx` checks `e.ctrlKey` directly; needs a platform-aware modifier.
- [ ] **Packaging**: add a `mac` target (dmg + zip), plus notarization/codesigning.
- [ ] **CI**: add a macOS runner to the build matrix.

## Terminal

- [ ] Persist workspace + pane layout across restarts (respawn shells in saved cwds).
- [ ] Scrollback search (`@xterm/addon-search`).
- [ ] Copy-on-select and a proper right-click paste.
- [ ] Configurable font / theme / keybindings via a config file.
- [ ] Pane navigation by direction (Ctrl+Shift+Arrow), not just close/zoom.
- [ ] `Ctrl+Shift+P` command palette.

## Worktree splitting

- [ ] Full patch view in the merge pane (`git:patch` is already wired in the preload
      and main, but the UI only renders `--stat`).
- [ ] Dependency-aware waves: let the planner mark task B as depending on task A and
      run them in order instead of all at once (cmux/wmux do this).
- [ ] Auto-commit an agent's work when its pane goes idle, so the merge view is
      never stale.
- [ ] Reviewer agent that reads the combined diff and proposes fixes.
- [ ] Conflict resolution UI instead of `merge --abort`.
- [ ] "Adopt existing worktrees" — reattach panes to worktrees from a previous session.

## Performance

- [ ] Measure real input latency (typometer or a high-speed capture) rather than
      trusting the architecture. Current design removes React and `ipcRenderer` from
      the keystroke path, but this is unmeasured.
- [ ] Consider a binary (`Uint8Array`) transport over the MessagePort instead of
      strings to skip a UTF-16 conversion per chunk.
