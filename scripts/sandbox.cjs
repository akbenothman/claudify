/**
 * Point a smoke test at its own userData directory.
 *
 * The tests wipe claudify-state.json and dashboard.json to get a clean slate.
 * Under the app's real userData that is the USER'S saved session and the USER'S
 * todo list — running the suite destroyed both, and running it while the app was
 * open let the two race over the same file. Tests get their own sandbox instead.
 *
 * Must be called before `out/main/index.js` is required: the app resolves its
 * paths as soon as it loads.
 */
const { app } = require('electron')
const os = require('node:os')
const path = require('node:path')
const fs = require('node:fs')

module.exports = function sandbox(name) {
  app.setName('Claudify')

  const dir = path.join(os.tmpdir(), `claudify-smoke-${name}`)
  fs.mkdirSync(dir, { recursive: true })
  app.setPath('userData', dir)

  return {
    userData: dir,
    stateFile: path.join(dir, 'claudify-state.json'),
    dashFile: path.join(dir, 'dashboard.json')
  }
}
