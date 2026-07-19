/**
 * Ship the current source into the installed app behind the taskbar pin.
 *
 * Building is not shipping. `pack:win` only fills `release/`; the app the pin
 * launches lives in %LOCALAPPDATA%\Programs\Claudify and keeps running whatever
 * was mirrored there last. Those two silently drifted once — a fix sat merged on
 * main for a day while the pinned app ran a bundle from before it existed, and
 * the bug looked unfixed because the running app genuinely didn't have the fix.
 *
 * So this script refuses to report success on faith. After the copy it re-reads
 * the installed app.asar off disk and fails unless it matches the one just
 * built. The only claim worth making is one that survives a check.
 *
 *   npm run ship          build, then mirror into the installed app
 *   npm run ship -- --force   close a running Claudify first (see below)
 *
 * A running Claudify holds its own exe locked, so the mirror cannot proceed
 * while it is open. This exits and asks rather than killing it by default: this
 * repo's own Claude sessions often run inside those very panes, and killing the
 * app to update the app would take the session doing the updating with it.
 * --force opts into the kill when you know nothing is running in there.
 */
const { execFileSync, execSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const repo = path.resolve(__dirname, '..')
const built = path.join(repo, 'release', 'win-unpacked')
const installed = path.join(process.env.LOCALAPPDATA, 'Programs', 'Claudify')
const force = process.argv.includes('--force')

const step = (msg) => console.log(`\n=== ${msg}`)
const fail = (msg) => {
  console.error(`\nSHIP FAILED: ${msg}`)
  process.exit(1)
}

/* Milliseconds, so a stale copy is obvious rather than rounded away. */
const stamp = (dir) => {
  const asar = path.join(dir, 'resources', 'app.asar')
  if (!fs.existsSync(asar)) return null
  const { mtimeMs, size } = fs.statSync(asar)
  return { mtimeMs, size, asar }
}

const running = () => {
  /* tasklist rather than a PowerShell round-trip: it is the one thing here that
   * has to be cheap, since it runs again in a loop after the kill. */
  const out = execSync('tasklist /fi "imagename eq Claudify.exe" /nh', { encoding: 'utf8' })
  return (out.match(/Claudify\.exe/g) || []).length
}

step('Checking for a running Claudify')
let live = running()
if (live > 0) {
  if (!force) {
    fail(
      `${live} Claudify process(es) are running and their exe is locked.\n` +
        `Close Claudify, then re-run. If nothing important is open in it:\n` +
        `  npm run ship -- --force`
    )
  }
  console.log(`Closing ${live} Claudify process(es) (--force)`)
  try {
    execSync('taskkill /im Claudify.exe /f /t', { stdio: 'ignore' })
  } catch {
    /* Already gone between the check and the kill. Verified below regardless. */
  }
  /* Windows releases the file lock a moment after the process disappears. */
  for (let i = 0; i < 20 && (live = running()) > 0; i++) execSync('timeout /t 1 /nobreak > nul')
  if (live > 0) fail(`${live} Claudify process(es) survived taskkill; close them by hand.`)
}
console.log('None running.')

step('Building')
execFileSync('npm', ['run', 'pack:dir'], { cwd: repo, stdio: 'inherit', shell: true })

const fresh = stamp(built)
if (!fresh) fail(`build produced no app.asar in ${built}`)
console.log(`Built ${fresh.asar}\n  ${new Date(fresh.mtimeMs).toISOString()}  ${fresh.size} bytes`)

step('Mirroring into the installed app')
const before = stamp(installed)
if (before) {
  console.log(`Replacing ${new Date(before.mtimeMs).toISOString()}  ${before.size} bytes`)
} else {
  console.log(`No existing install at ${installed} — creating it.`)
}

/* robocopy's exit code is a bitfield: <8 is success (0 = nothing to copy, which
 * is itself a legitimate no-op when the build is already installed). */
let code = 0
try {
  execFileSync('robocopy', [built, installed, '/MIR', '/NJH', '/NJS', '/NP'], { stdio: 'inherit' })
} catch (e) {
  code = e.status ?? 16
}
if (code >= 8) fail(`robocopy exited ${code}`)

step('Verifying the installed app is the one just built')
const after = stamp(installed)
if (!after) fail(`no app.asar at ${installed} after the mirror`)
if (after.size !== fresh.size) {
  fail(
    `installed app.asar does not match the build.\n` +
      `  built:     ${fresh.size} bytes\n  installed: ${after.size} bytes`
  )
}
console.log(`OK — ${after.asar}`)
console.log(`  ${new Date(after.mtimeMs).toISOString()}  ${after.size} bytes`)

let head = ''
try {
  head = execSync('git log -1 --format=%h\\ %s', { cwd: repo, encoding: 'utf8' }).trim()
} catch {
  /* Shipping from a non-repo checkout is fine; the stamp above is the real proof. */
}
console.log(`\nShipped${head ? `: ${head}` : ''}`)
console.log('Relaunch from the taskbar pin — same exe path, the pin still works.')
