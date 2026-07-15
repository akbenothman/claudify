/**
 * A just-enough unified-diff parser for hunk adoption.
 *
 * `git diff` output is a sequence of file sections, each a header (the
 * `diff --git` / `index` / `---` / `+++` lines) followed by one or more `@@`
 * hunks. To adopt a subset of the changes we re-emit a file's header with only
 * the chosen hunks — the hunk bodies are copied verbatim, so their line counts
 * stay valid and `git apply` accepts the result.
 */

export interface Hunk {
  /** The `@@ -a,b +c,d @@` line. */
  header: string
  /** Every line of the hunk body, verbatim (leading ` `, `+`, `-`). */
  lines: string[]
  /** For display: net +/- of this hunk. */
  added: number
  removed: number
}

export interface FileDiff {
  /** Path shown in the UI (the b-side path). */
  path: string
  /** Header lines up to (not including) the first `@@`. */
  header: string[]
  hunks: Hunk[]
  /** Binary files can't be hunk-adopted. */
  binary: boolean
}

function bPath(diffLine: string): string {
  const m = / b\/(.+)$/.exec(diffLine)
  return m ? m[1] : diffLine.replace(/^diff --git /, '')
}

export function parseDiff(patch: string): FileDiff[] {
  const files: FileDiff[] = []
  let cur: FileDiff | null = null
  let hunk: Hunk | null = null

  const flushHunk = () => {
    if (hunk && cur) cur.hunks.push(hunk)
    hunk = null
  }
  const flushFile = () => {
    flushHunk()
    if (cur) files.push(cur)
    cur = null
  }

  for (const line of patch.split('\n')) {
    if (line.startsWith('diff --git')) {
      flushFile()
      cur = { path: bPath(line), header: [line], hunks: [], binary: false }
    } else if (!cur) {
      continue
    } else if (line.startsWith('@@')) {
      flushHunk()
      hunk = { header: line, lines: [], added: 0, removed: 0 }
    } else if (hunk) {
      hunk.lines.push(line)
      if (line.startsWith('+')) hunk.added++
      else if (line.startsWith('-')) hunk.removed++
    } else {
      // Still in the file header region.
      if (line.startsWith('Binary files')) cur.binary = true
      if (line.startsWith('+++ ')) {
        const p = line.slice(4).replace(/^b\//, '')
        if (p && p !== '/dev/null') cur.path = p
      }
      cur.header.push(line)
    }
  }
  flushFile()
  return files
}

/**
 * Rebuild a patch containing only the selected hunks. `selected` is a set of
 * `"<fileIndex>:<hunkIndex>"` keys.
 */
export function buildPatch(files: FileDiff[], selected: Set<string>): string {
  const out: string[] = []
  files.forEach((f, fi) => {
    const chosen = f.hunks.filter((_, hi) => selected.has(`${fi}:${hi}`))
    if (chosen.length === 0) return
    out.push(...f.header)
    for (const h of chosen) {
      out.push(h.header)
      out.push(...h.lines)
    }
  })
  // git apply wants a trailing newline.
  return out.length ? out.join('\n') + '\n' : ''
}
