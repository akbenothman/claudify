import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'
import { activeWorkspace, useStore } from '../store'
import { getSearch } from '../paneSearch'

/**
 * Find-in-terminal bar (Ctrl+Shift+F). A single overlay that drives whichever
 * terminal pane is focused, via the search registry each TerminalPane populates
 * on mount. Enter jumps to the next match, Shift+Enter the previous, Esc closes
 * and clears the highlights.
 */
export function TermSearch({ onClose }: { onClose: () => void }) {
  const ws = useStore(activeWorkspace)
  const tab = ws?.tabs.find((t) => t.id === ws.activeTabId)
  const paneId = tab?.activePaneId ?? null
  const kind = paneId ? tab?.panes[paneId]?.kind : undefined
  const api = paneId && kind === 'terminal' ? getSearch(paneId) : undefined

  const [q, setQ] = useState('')
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [])

  const next = (): void => {
    if (q && api) api.findNext(q)
  }
  const prev = (): void => {
    if (q && api) api.findPrevious(q)
  }
  const close = (): void => {
    api?.clear()
    onClose()
  }

  return (
    <div className="term-search" onMouseDown={(e) => e.stopPropagation()}>
      <input
        ref={ref}
        value={q}
        placeholder={api ? 'find in terminal…' : 'focus a terminal to search'}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Enter') {
            e.preventDefault()
            if (e.shiftKey) prev()
            else next()
          } else if (e.key === 'Escape') {
            e.preventDefault()
            close()
          }
        }}
      />
      <button onClick={prev} disabled={!api} title="Previous (Shift+Enter)">
        ↑
      </button>
      <button onClick={next} disabled={!api} title="Next (Enter)">
        ↓
      </button>
      <button onClick={close} title="Close (Esc)">
        <Icon name="close" size={11} />
      </button>
    </div>
  )
}
