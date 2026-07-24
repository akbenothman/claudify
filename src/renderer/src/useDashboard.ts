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

/** Local `YYYY-MM-DD` for a date — the key habits are stored under. */
export function dayKey(d: Date = new Date()): string {
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** `d` days before today, as a `YYYY-MM-DD` key. */
export const daysAgo = (n: number): string => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return dayKey(d)
}

/**
 * Money, short. Balances and revenue are glanced at, not audited: 12.4k reads
 * faster than 12,417.83, and the exact figure is one hover away in the title.
 */
export function money(n: number, currency = '$'): string {
  const sign = n < 0 ? '-' : ''
  const v = Math.abs(n)
  if (v >= 1_000_000) return `${sign}${currency}${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}M`
  if (v >= 10_000) return `${sign}${currency}${(v / 1000).toFixed(v >= 100_000 ? 0 : 1)}k`
  // Cents matter on a €4.99 subscription and are noise on a $2,269 surplus —
  // and a derived figure (a yearly bill divided by 12) always has them.
  return `${sign}${currency}${v.toLocaleString(undefined, {
    maximumFractionDigits: v >= 1000 ? 0 : 2
  })}`
}

/** The same amount in full, for a tooltip. */
export const moneyExact = (n: number, currency = '$'): string =>
  `${n < 0 ? '-' : ''}${currency}${Math.abs(n).toLocaleString(undefined, {
    maximumFractionDigits: 2
  })}`

/** Everything on a recurring schedule normalised to a monthly figure. */
export const perMonth = (amount: number, cadence: 'weekly' | 'monthly' | 'yearly'): number =>
  cadence === 'weekly' ? (amount * 52) / 12 : cadence === 'yearly' ? amount / 12 : amount
