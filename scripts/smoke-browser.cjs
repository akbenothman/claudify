/**
 * Browser + MCP smoke test.
 *
 * The claim that matters: an agent can drive a real browser through claudify's
 * built-in MCP server. We exercise the whole path the way Claude would — speak
 * MCP over HTTP to the in-process server (initialize → tools/call), navigate the
 * browser to a page, and read the DOM back out — with no renderer involved.
 *
 *   npm run build && npx electron scripts/smoke-browser.cjs
 */
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const { stateFile, userData } = require('./sandbox.cjs')('browser')
if (fs.existsSync(stateFile)) fs.rmSync(stateFile)

require('../out/main/index.js')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fail = (msg) => {
  console.error(`BROWSER FAIL: ${msg}`)
  app.exit(1)
}

// A minimal MCP-over-HTTP client: carries the session id and protocol version
// the server hands back, exactly as a real client does.
function mcpClient(url) {
  let sessionId = null
  let protocolVersion = '2025-06-18'
  const call = async (method, params, isNotification = false) => {
    const headers = {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'mcp-protocol-version': protocolVersion
    }
    if (sessionId) headers['mcp-session-id'] = sessionId
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ jsonrpc: '2.0', ...(isNotification ? {} : { id: Math.floor(Math.random() * 1e6) }), method, params })
    })
    const sid = res.headers.get('mcp-session-id')
    if (sid) sessionId = sid
    if (isNotification) return null
    const text = await res.text()
    // enableJsonResponse gives us JSON; be lenient and also handle an SSE frame.
    const jsonLine = text.startsWith('{') ? text : (text.match(/^data: (.+)$/m) || [])[1]
    if (!jsonLine) throw new Error(`non-JSON MCP response (${res.status}): ${text.slice(0, 200)}`)
    const msg = JSON.parse(jsonLine)
    if (msg.error) throw new Error(`MCP error: ${JSON.stringify(msg.error)}`)
    return msg.result
  }
  return {
    async init() {
      const r = await call('initialize', {
        protocolVersion,
        capabilities: {},
        clientInfo: { name: 'smoke', version: '0' }
      })
      if (r?.protocolVersion) protocolVersion = r.protocolVersion
      await call('notifications/initialized', {}, true)
      return r
    },
    call
  }
}

app.whenReady().then(async () => {
  const win = BrowserWindow.getAllWindows()[0]
  if (!win) return fail('no BrowserWindow')
  if (win.webContents.isLoading()) {
    await new Promise((r) => win.webContents.once('did-finish-load', r))
  }
  win.showInactive()
  await sleep(2500)
  setTimeout(() => fail('timed out after 40s'), 40_000)

  // The MCP server wrote its URL to claudify's own mcp.json.
  const cfgPath = path.join(userData, 'mcp.json')
  if (!fs.existsSync(cfgPath)) return fail('mcp.json was not written — MCP server did not start')
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'))
  const url = cfg.mcpServers?.['claudify-browser']?.url
  if (!url) return fail(`mcp.json has no claudify-browser url: ${JSON.stringify(cfg)}`)
  console.log(`  MCP server advertised at ${url} ✓`)

  const mcp = mcpClient(url)
  const initResult = await mcp.init()
  console.log(`  initialize handshake ok (server ${initResult.serverInfo?.name}) ✓`)

  // tools/list — the browser tools must be there for Claude to see.
  const tools = (await mcp.call('tools/list', {})).tools.map((t) => t.name)
  for (const need of ['browser_navigate', 'browser_evaluate', 'browser_snapshot']) {
    if (!tools.includes(need)) return fail(`tool ${need} missing from tools/list: ${JSON.stringify(tools)}`)
  }
  console.log(`  tools/list exposes the browser tools: ${tools.join(', ')} ✓`)

  // Navigate the real browser to a page…
  const page = 'data:text/html,' + encodeURIComponent('<title>Claudify Test</title><h1>Hello Claudify</h1><p id=x>42</p>')
  const nav = await mcp.call('tools/call', { name: 'browser_navigate', arguments: { url: page } })
  const navText = nav.content?.[0]?.text || ''
  if (!/Claudify Test/.test(navText)) return fail(`navigate did not report the page title: ${navText}`)
  console.log(`  browser_navigate loaded the page ✓`)

  // …then read the DOM back out, exactly like the eldthq.com example.
  const evalRes = await mcp.call('tools/call', {
    name: 'browser_evaluate',
    arguments: { expression: "document.querySelector('h1').textContent + '|' + document.getElementById('x').textContent" }
  })
  const value = evalRes.content?.[0]?.text || ''
  if (value !== 'Hello Claudify|42') {
    return fail(`browser_evaluate returned the wrong DOM value: ${JSON.stringify(value)}`)
  }
  console.log(`  browser_evaluate read the DOM: ${JSON.stringify(value)} ✓`)

  // A snapshot should carry the visible text.
  const snap = await mcp.call('tools/call', { name: 'browser_snapshot', arguments: {} })
  if (!/Hello Claudify/.test(snap.content?.[0]?.text || '')) {
    return fail(`browser_snapshot missing the page text`)
  }
  console.log(`  browser_snapshot captured the page text ✓`)

  console.log('BROWSER PASS')
  app.exit(0)
})
