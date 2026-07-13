import { existsSync } from 'node:fs'
import path from 'node:path'
import type { ShellInfo } from '../shared/types'

const sysRoot = process.env.SystemRoot || 'C:\\Windows'
const programFiles = process.env.ProgramFiles || 'C:\\Program Files'
const localAppData = process.env.LOCALAPPDATA || ''

/** Every shell we know how to look for, in the order they're offered. */
const WIN_CANDIDATES: ShellInfo[] = [
  {
    id: 'cmd',
    label: 'Command Prompt',
    path: path.join(sysRoot, 'System32', 'cmd.exe'),
    args: []
  },
  {
    id: 'pwsh',
    label: 'PowerShell 7',
    path: path.join(programFiles, 'PowerShell', '7', 'pwsh.exe'),
    args: ['-NoLogo']
  },
  {
    id: 'powershell',
    label: 'Windows PowerShell',
    path: path.join(sysRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    args: ['-NoLogo']
  },
  {
    id: 'gitbash',
    label: 'Git Bash',
    path: path.join(programFiles, 'Git', 'bin', 'bash.exe'),
    args: ['--login', '-i']
  },
  {
    id: 'wsl',
    label: 'WSL',
    path: path.join(sysRoot, 'System32', 'wsl.exe'),
    args: []
  },
  {
    id: 'nu',
    label: 'Nushell',
    path: path.join(programFiles, 'nu', 'bin', 'nu.exe'),
    args: []
  }
]

const POSIX_CANDIDATES: ShellInfo[] = [
  { id: 'zsh', label: 'zsh', path: '/bin/zsh', args: ['-l'] },
  { id: 'bash', label: 'bash', path: '/bin/bash', args: ['-l'] },
  { id: 'sh', label: 'sh', path: '/bin/sh', args: [] }
]

/** Only the shells actually installed on this machine. */
export function detectShells(): ShellInfo[] {
  const candidates = process.platform === 'win32' ? WIN_CANDIDATES : POSIX_CANDIDATES
  const found = candidates.filter((s) => existsSync(s.path))

  // Scoop/winget put Nushell under LocalAppData; check there too before giving up.
  if (process.platform === 'win32' && localAppData && !found.some((s) => s.id === 'nu')) {
    const alt = path.join(localAppData, 'Programs', 'nu', 'bin', 'nu.exe')
    if (existsSync(alt)) {
      found.push({ id: 'nu', label: 'Nushell', path: alt, args: [] })
    }
  }
  return found
}

/** The shell to use for `id`, falling back to whatever is available. */
export function resolveShell(id: string | undefined): ShellInfo {
  const shells = detectShells()
  const byId = shells.find((s) => s.id === id)
  if (byId) return byId

  // Prefer cmd on Windows: it's the "normal" terminal and always present.
  const preferred = process.platform === 'win32' ? ['cmd', 'powershell', 'pwsh'] : ['zsh', 'bash']
  for (const p of preferred) {
    const hit = shells.find((s) => s.id === p)
    if (hit) return hit
  }
  if (shells[0]) return shells[0]

  // Nothing detected at all — fall back to something the OS will resolve on PATH.
  return process.platform === 'win32'
    ? { id: 'cmd', label: 'Command Prompt', path: 'cmd.exe', args: [] }
    : { id: 'sh', label: 'sh', path: process.env.SHELL || '/bin/sh', args: [] }
}

export const DEFAULT_SHELL_ID = process.platform === 'win32' ? 'cmd' : 'zsh'
