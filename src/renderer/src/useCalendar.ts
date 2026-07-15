import { useCallback, useEffect, useState } from 'react'
import type { Calendar } from '../../shared/types'

/**
 * The calendar file, kept in sync both ways: the pane writes add/delete
 * requests, and an agent editing the file (after syncing Google Calendar via
 * the MCP) pushes straight back into the UI. Mirrors useDashboard.
 */
export function useCalendar(): {
  data: Calendar | null
  update: (fn: (c: Calendar) => Calendar) => void
} {
  const [data, setData] = useState<Calendar | null>(null)

  useEffect(() => {
    let live = true
    window.claudify.getCalendar().then((c) => live && setData(c))
    const off = window.claudify.onCalendarChanged((c) => live && setData(c))
    return () => {
      live = false
      off()
    }
  }, [])

  const update = useCallback((fn: (c: Calendar) => Calendar) => {
    setData((cur) => {
      if (!cur) return cur
      const next = fn(cur)
      window.claudify.saveCalendar(next).catch(() => {})
      return next
    })
  }, [])

  return { data, update }
}
