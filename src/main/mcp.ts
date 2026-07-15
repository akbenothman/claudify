import { app } from 'electron'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import * as browser from './browser'

/**
 * An MCP server that runs inside claudify's own main process and exposes the
 * browser to any agent — this is what makes `browser_navigate` /
 * `browser_evaluate` appear in Claude's tool list, the same "zero-config MCP"
 * wmux ships. It's HTTP (Streamable) on localhost, so the server lives in the
 * process that owns the browser; no separate process, no IPC bridge.
 *
 * We deliberately run one MCP server in the main process rather than the
 * dashboard's file-protocol bet: a live browser needs a live channel.
 */

const text = (t: string) => ({ content: [{ type: 'text' as const, text: t }] })

/** A fresh server with the browser tools registered. Cheap to build per request. */
function buildServer(): McpServer {
  const server = new McpServer({ name: 'claudify-browser', version: '0.1.0' })

  server.registerTool(
    'browser_navigate',
    {
      description: 'Open a URL in the claudify browser and wait for it to load.',
      inputSchema: { url: z.string().describe('The URL to open.') }
    },
    async ({ url }) => {
      const i = await browser.navigate(url)
      return text(`Navigated to ${i.url}\nTitle: ${i.title}`)
    }
  )

  server.registerTool(
    'browser_evaluate',
    {
      description:
        'Run a JavaScript expression in the current page and return the result. Use this to read the DOM, computed styles, text, or anything else on the page.',
      inputSchema: { expression: z.string().describe('A JavaScript expression to evaluate in the page.') }
    },
    async ({ expression }) => {
      const r = await browser.evaluate(expression)
      return text(typeof r === 'string' ? r : JSON.stringify(r, null, 1))
    }
  )

  server.registerTool(
    'browser_snapshot',
    { description: 'A text snapshot of the current page: title, url, visible text, and interactive elements with selectors.' },
    async () => text(await browser.snapshot())
  )

  server.registerTool(
    'browser_screenshot',
    { description: 'Capture a PNG screenshot of the current page.' },
    async () => ({
      content: [{ type: 'image' as const, data: await browser.screenshot(), mimeType: 'image/png' }]
    })
  )

  server.registerTool(
    'browser_click',
    {
      description: 'Click the first element matching a CSS selector.',
      inputSchema: { selector: z.string().describe('A CSS selector, e.g. "button.submit" or "#login".') }
    },
    async ({ selector }) => {
      const i = await browser.click(selector)
      return text(`Clicked ${selector}. Now on ${i.url}`)
    }
  )

  server.registerTool('browser_back', { description: 'Go back in the browser history.' }, async () => {
    const i = await browser.goBack()
    return text(`Back to ${i.url}`)
  })

  server.registerTool('browser_reload', { description: 'Reload the current page.' }, async () => {
    const i = await browser.reload()
    return text(`Reloaded ${i.url}`)
  })

  return server
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : undefined)
      } catch {
        resolve(undefined)
      }
    })
    req.on('error', () => resolve(undefined))
  })
}

let httpServer: Server | null = null
let port = 0

/**
 * One transport per client session, keyed by the id the SDK mints on
 * initialize. The client sends that id back on every later request (the
 * `mcp-session-id` header), so the initialize → tools/call handshake stays
 * connected — which a per-request server could not do.
 */
const transports = new Map<string, StreamableHTTPServerTransport>()

async function handlePost(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readBody(req)
  const sessionId = req.headers['mcp-session-id']
  const existing = typeof sessionId === 'string' ? transports.get(sessionId) : undefined

  let transport: StreamableHTTPServerTransport
  if (existing) {
    transport = existing
  } else if (!sessionId && isInitializeRequest(body)) {
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      enableJsonResponse: true,
      onsessioninitialized: (id) => {
        transports.set(id, transport)
      }
    })
    transport.onclose = () => {
      if (transport.sessionId) transports.delete(transport.sessionId)
    }
    await buildServer().connect(transport)
  } else {
    res.writeHead(400, { 'content-type': 'application/json' }).end(
      JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message: 'No valid session' }, id: null })
    )
    return
  }
  await transport.handleRequest(req, res, body)
}

/** GET (open the SSE stream) and DELETE (end the session) go by session id. */
async function handleSession(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const sessionId = req.headers['mcp-session-id']
  const transport = typeof sessionId === 'string' ? transports.get(sessionId) : undefined
  if (!transport) {
    res.writeHead(400).end('Invalid or missing session id')
    return
  }
  await transport.handleRequest(req, res)
}

/** Starts the MCP HTTP server on an ephemeral localhost port and returns it. */
export function startMcp(): Promise<number> {
  return new Promise((resolve, reject) => {
    httpServer = createServer(async (req, res) => {
      if (!req.url?.startsWith('/mcp')) {
        res.writeHead(404).end()
        return
      }
      try {
        if (req.method === 'POST') await handlePost(req, res)
        else if (req.method === 'GET' || req.method === 'DELETE') await handleSession(req, res)
        else res.writeHead(405).end()
      } catch {
        if (!res.headersSent) res.writeHead(500).end()
      }
    })
    // Localhost only — this drives a real browser; it must not be reachable off
    // the machine.
    httpServer.listen(0, '127.0.0.1', () => {
      const addr = httpServer?.address()
      port = typeof addr === 'object' && addr ? addr.port : 0
      writeMcpConfig(port)
      resolve(port)
    })
    httpServer.on('error', reject)
  })
}

export function mcpConfigPath(): string {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return path.join(dir, 'mcp.json')
}

/**
 * claudify's own MCP config, pointed at the live port. Panes launch
 * `claude --mcp-config <this>` so the browser tools appear automatically,
 * without ever touching the user's global Claude config.
 */
function writeMcpConfig(p: number): void {
  const cfg = {
    mcpServers: { 'claudify-browser': { type: 'http', url: `http://127.0.0.1:${p}/mcp` } }
  }
  try {
    writeFileSync(mcpConfigPath(), JSON.stringify(cfg, null, 2), 'utf8')
  } catch {
    /* if we can't write it, panes just won't get the browser tools */
  }
}

export function mcpPort(): number {
  return port
}

export function stopMcp(): void {
  for (const t of transports.values()) t.close()
  transports.clear()
  httpServer?.close()
  httpServer = null
}
