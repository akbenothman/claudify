/**
 * Smart pane naming.
 *
 * A terminal called "shell" tells you nothing when you have nine of them. We
 * derive a name from what you actually do in the pane: the command you ran, or
 * — once you're inside an agent CLI — the topic you're talking about.
 */

/** Commands that say nothing about what the pane is *for*. */
const NOISE = new Set([
  'ls', 'dir', 'clear', 'cls', 'pwd', 'exit', 'echo', 'cat', 'type',
  'which', 'where', 'whoami', 'history', 'help'
])

/** Agent CLIs — after one of these runs, the pane switches to topic naming. */
const AGENTS = new Set(['claude', 'codex', 'aider', 'gemini', 'goose', 'amp', 'opencode'])

const basename = (p: string): string =>
  p.replace(/["']/g, '').replace(/[/\\]+$/, '').split(/[/\\]/).pop() || p

const trim = (s: string, n = 28): string => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

/** True when this command hands the pane over to an agent CLI. */
export function isAgentCommand(line: string): boolean {
  const head = line.trim().split(/\s+/)[0]?.toLowerCase()
  return !!head && AGENTS.has(basename(head).replace(/\.(exe|cmd|bat)$/, ''))
}

/**
 * A short label for a command line, or null if the command isn't worth
 * renaming the pane for.
 */
export function commandTitle(line: string): string | null {
  const cmd = line.trim()
  if (!cmd || cmd.length < 2) return null

  const parts = cmd.split(/\s+/)
  const raw = basename(parts[0]).replace(/\.(exe|cmd|bat|ps1)$/i, '').toLowerCase()
  const args = parts.slice(1).filter((a) => !a.startsWith('-'))

  if (raw === 'cd') {
    const target = args[0]
    return target ? trim(basename(target)) : null
  }

  if (NOISE.has(raw)) return null

  if (AGENTS.has(raw)) {
    // `claude "add dark mode"` names itself from the prompt.
    const prompt = cmd.slice(parts[0].length).trim().replace(/^["']|["']$/g, '')
    return prompt ? trim(`${raw}: ${topicTitle(prompt) ?? prompt}`) : raw
  }

  if (raw === 'git') return args[0] ? trim(`git ${args[0]}`) : 'git'

  if (raw === 'npm' || raw === 'pnpm' || raw === 'yarn' || raw === 'bun') {
    const sub = args[0] === 'run' ? args[1] : args[0]
    return sub ? trim(`${raw} ${sub}`) : raw
  }

  if (raw === 'ssh' || raw === 'docker' || raw === 'kubectl' || raw === 'cargo') {
    return args[0] ? trim(`${raw} ${args[0]}`) : raw
  }

  if (raw === 'python' || raw === 'python3' || raw === 'node' || raw === 'deno') {
    return args[0] ? trim(`${raw} ${basename(args[0])}`) : raw
  }

  if (['vim', 'nvim', 'nano', 'code', 'notepad'].includes(raw)) {
    return args[0] ? trim(`edit ${basename(args[0])}`) : raw
  }

  // Default: the command, plus its first argument when that's still short.
  const first = args[0]
  if (first && first.length <= 14) return trim(`${raw} ${basename(first)}`)
  return trim(raw)
}

/**
 * A label for a line of prose typed at an agent — i.e. what you're talking
 * about. Drops filler words so "can you please add dark mode to the settings"
 * becomes "add dark mode".
 */
const FILLER = new Set([
  'can', 'you', 'please', 'the', 'a', 'an', 'to', 'for', 'of', 'and', 'my',
  'i', 'want', 'need', 'lets', "let's", 'would', 'could', 'should', 'do',
  'make', 'me', 'is', 'it', 'that', 'this', 'in', 'on', 'with', 'now'
])

export function topicTitle(line: string): string | null {
  const words = line
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s/._-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

  if (words.length === 0) return null

  const meaty = words.filter((w) => !FILLER.has(w))
  const chosen = (meaty.length >= 2 ? meaty : words).slice(0, 4)
  if (chosen.length === 0) return null

  const title = chosen.join(' ')
  return title.length < 3 ? null : trim(title)
}
