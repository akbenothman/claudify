import type { ReactNode } from 'react'
import { Icon, PAGE_ICONS } from './Icon'

/**
 * The shell every dashboard page wears: a big title, a line of context, room
 * for actions on the right, and a scrolling body underneath.
 *
 * Pages share it so the dashboard reads as one application rather than a set of
 * unrelated widgets — the same header height, the same rhythm, the same place
 * to look for the "add" button on every screen.
 */
export function Page({
  kind,
  title,
  subtitle,
  actions,
  children
}: {
  /** Pane kind, which picks the page's icon. */
  kind: string
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <div className={`page page-${kind}`}>
      <header className="page-head">
        <span className={`page-glyph glyph-${kind}`}>
          <Icon name={PAGE_ICONS[kind] ?? 'home'} size={18} />
        </span>
        <div className="page-heading">
          <h1>{title}</h1>
          {subtitle && <div className="page-sub">{subtitle}</div>}
        </div>
        {actions && <div className="page-actions">{actions}</div>}
      </header>
      <div className="page-body">{children}</div>
    </div>
  )
}

/** A headline number with a label under it. The dashboard's unit of "at a glance". */
export function Stat({
  label,
  value,
  hint,
  tone
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  /** Colours the value: good news green, bad news red, otherwise neutral. */
  tone?: 'up' | 'down' | 'accent'
}) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={`stat-value${tone ? ` stat-${tone}` : ''}`}>{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  )
}

/** A horizontal progress bar, 0–100. */
export function Meter({ pct, tone }: { pct: number; tone?: string }) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)))
  return (
    <div className="meter" role="progressbar" aria-valuenow={clamped}>
      <div className={`meter-fill${tone ? ` meter-${tone}` : ''}`} style={{ width: `${clamped}%` }} />
    </div>
  )
}

/** What a page shows before you've put anything in it. */
export function Blank({ icon, text, hint }: { icon: string; text: string; hint?: string }) {
  return (
    <div className="blank">
      <span className="blank-glyph">
        <Icon name={PAGE_ICONS[icon] ?? 'home'} size={26} />
      </span>
      <div className="blank-text">{text}</div>
      {hint && <div className="blank-hint">{hint}</div>}
    </div>
  )
}

/** A card: the box everything on a page lives in. */
export function Card({
  title,
  action,
  children,
  className
}: {
  title?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`card${className ? ` ${className}` : ''}`}>
      {(title || action) && (
        <div className="card-head">
          {title && <h2>{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}
