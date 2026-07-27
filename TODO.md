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
- [x] Reopen the *conversation*, not just the pane. A Claude pane records the
      session it is holding (captured from the transcript watcher, one owner per
      thread) and comes back on `claude --resume <id>`; the active tab and the
      zoomed pane come back too. Guarded by a cwd match and a transcript-exists
      probe, because `--resume` on a purged id exits 0 and looks like success.
      Permission flags are deliberately *not* restored — an automatic restore is
      no place to silently re-grant `--dangerously-skip-permissions`.

## Dashboard

- [x] Permanent AK Dashboard workspace (terminal + Claude + todos + conversation tracker).
- [x] Claude controls it by editing `dashboard.json`; the app watches the file.
- [x] Calendar tab — reads `calendar.json` (filled by an agent via the Google Calendar
      MCP), shows upcoming events, and writes add/delete requests back.
- [x] Auto-populate the conversation tracker from real Claude Code sessions
      (`~/.claude/projects/**`) instead of only manual/agent entries — the Sessions
      page reads `transcript.ts` directly.
- [x] Every session row opens: jump to the pane already running that thread, or
      resume it (`claude --resume`) in a tab in its own project's workspace. Never
      resumes a thread that's already live — two Claudes on one transcript is
      unrecoverable.
- [x] Link out to the real Google Calendar from the calendar page, on the month
      you're looking at.
- [ ] Toast / taskbar flash *automatically* when a pane finishes in the background.
      (The mechanism exists — `control.ts`'s `notify` — an agent can already raise
      one; doing it on every finish without being asked is the missing part.)

## Dashboard — the gap to the apps people actually use

Reviewed against Sunsama / Motion / Akiflow (daily planning), Todoist / TickTick
(capture), Notion (structure), YNAB / Monarch (money), Habitica / Streaks
(habits). The pages here are competitive on *display*. What's missing is almost
entirely **time, alerting, and history** — plus one real bug.

Ordered by value per unit of work.

- [ ] **A momentarily-malformed `dashboard.json` destroys it. Reproduced.**
      `readDashboard`'s catch returns `EMPTY`, the watcher pushes that into the
      renderer, and the next UI edit saves the empty shape over the real file. An
      agent caught mid-write — the exact usage this design invites — is enough.
      Measured, against a file holding one todo:
        1. half-written file appears  -> UI goes blank
        2. agent finishes the write   -> **UI stays blank** (see below)
        3. user types one new todo    -> the old todo is gone from disk
      Step 2 is a second bug in its own right: `watchDashboard` skips any change
      whose bytes equal `lastWritten`, so a file *restored* to what the app last
      wrote is invisible to it, and the app never recovers on its own.
      Fix: hold the last good state on a parse failure instead of handing back
      `EMPTY`; drop the `lastWritten` shortcut (or clear it whenever a read
      fails); roll a `.bak` before each write. Nothing else on this list matters
      if the file can evaporate.
- [ ] **Todos have no dates.** `Todo` is `{text, status}` — no due, no scheduled
      day, no priority, no recurrence. So Home's "Today" card isn't today, it's
      "open, ordered by status", and there is no way to say "this is Thursday's
      problem". This is the single biggest functional gap against every task app
      in the comparison set. Add `due` / `scheduled` / `priority` / `repeat`, and
      parse them out of the capture box ("pay rent friday") the way Todoist does.
- [ ] **The calendar and the todo list have never met.** That fusion IS the
      product for Sunsama/Motion/Akiflow, and claudify already has both halves in
      the same file-watching world. Cheapest real version: one "Today" column with
      today's events and today's tasks interleaved; then dragging a task onto a
      day sets its date.
- [ ] **Nothing keeps history, so nothing has a trend.** Net worth is a number,
      not the Monarch/Copilot line chart. Goals have progress but no trajectory;
      task completion has no rate. A `history[]` of daily snapshots (written by
      the resident Claude, or by the app at midnight) unlocks all three at once,
      and is what makes a dashboard feel like it has been paying attention.
- [ ] **No daily/weekly review.** Sunsama's whole business is the morning plan and
      the evening shutdown. This app has an idle Claude sitting in a tab with
      read/write access to the calendar, the todos, the habits and the ledger —
      it is better positioned to do this than anything on the market, and it
      currently doesn't. A drafted daily note + an end-of-day "here's what
      actually happened" is the highest-leverage feature on this page.
- [ ] **Nothing ever nags.** No reminders, no "standup in 10 minutes", no "rent
      leaves the account tomorrow", no "3-day streak about to break". A dashboard
      you have to remember to open is a page, not a dashboard. `control.ts`'s
      `notify` is already the delivery mechanism.
- [ ] **Capture only works if you're already on Home.** Every capture tool worth
      the name (Todoist, Akiflow, Raycast) has a global hotkey. This one needs you
      to navigate to the page you were trying to avoid navigating to.
- [ ] **No search.** Nothing finds a note, a todo or a goal by text. One box over
      `dashboard.json` covers all of it.
- [ ] **Home never says "look at this".** It's a set of totals. The alerts are all
      computable and none are shown: overdue, streak at risk, budget blown, goal
      untouched for a month, bill due this week.
- [ ] **Spend per session is sitting right there.** The transcripts are already
      parsed for cost per pane. "$X this week across N threads, by project" is a
      headline stat no other personal dashboard can show, and it belongs on Home.
- [ ] Business: ventures carry an `mrr` number with no history and no link to the
      todos or goals that move them. A venture should be able to show its own open
      tasks (it's the same file).
- [ ] Honest limitation, tracked not planned: everything here is desktop-only.
      Every app in the comparison set is on the phone. The plausible answer is the
      file — put `dashboard.json` in a git repo and let Claude on any device edit
      it — not a mobile client.

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

## Browser

- [x] A browser pane backed by Electron's own Chromium (`WebContentsView`), positioned over
      the pane and hidden when off screen (`browser.ts` + `BrowserPane.tsx`, `Ctrl+Shift+B`).
- [x] In-process MCP server exposing the browser as tools — `browser_navigate`,
      `browser_evaluate`, `browser_snapshot`, `browser_screenshot`, `browser_click`,
      `browser_back`, `browser_reload` (`mcp.ts`).
- [x] Zero-config registration: `claude` panes launch with `--mcp-config` pointing at
      claudify's own `mcp.json`, so the tools appear automatically without touching the
      user's global Claude config.
- [ ] Persist/restore the browser's current URL across a restart (today it comes back blank).
- [ ] Tabs within the browser pane, and a visible loading/spinner state.
- [ ] Downloads and file-upload handling for the browser.

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
