import { useCallback, useEffect, useState } from 'react'
import type { Dashboard } from '../../shared/types'

/**
 * The dashboard, kept in sync with the JSON file on disk in both directions:
 * the UI writes to it, and an agent editing the file pushes straight back into
 * the UI. Every dashboard pane shares this, so they never disagree.
 */
export function useDashboard(): {
  data: Dashboard | null
  update: (fn: (d: Dashboard) => Dashboard) => void
} {
  const [data, setData] = useState<Dashboard | null>(null)

  useEffect(() => {
    let live = true
    window.claudify.getDashboard().then((d) => live && setData(d))

    // Someone edited the file — most likely the Claude in the pane next door.
    const off = window.claudify.onDashboardChanged((d) => live && setData(d))
    return () => {
      live = false
      off()
    }
  }, [])

  const update = useCallback((fn: (d: Dashboard) => Dashboard) => {
    setData((cur) => {
      if (!cur) return cur
      const next = fn(cur)
      window.claudify.saveDashboard(next).catch(() => {})
      return next
    })
  }, [])

  return { data, update }
}

export const nowIso = (): string => new Date().toISOString()
export const newId = (): string => Math.random().toString(36).slice(2, 9)
