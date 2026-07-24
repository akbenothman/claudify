import type { ReactElement } from 'react'

/**
 * The app's icon set — inline SVG rather than glyph characters (⚙ ⑂ ★ ×).
 *
 * Glyphs came from whatever font happened to have them, so they arrived at
 * different weights and optical sizes and sat on the text baseline instead of
 * centring in their button. These are one stroke weight on one 16px grid, and
 * they take their colour from `currentColor` — so a hover rule on the button
 * still recolours the icon without any icon-specific CSS.
 */

const paths: Record<string, ReactElement> = {
  // Settings.
  gear: (
    <>
      <circle cx="8" cy="8" r="2.25" />
      <path d="M8 1.75l.85 1.6 1.8-.35.5 1.75 1.75.5-.35 1.8 1.6.95-1.6.95.35 1.8-1.75.5-.5 1.75-1.8-.35L8 14.25l-.85-1.6-1.8.35-.5-1.75-1.75-.5.35-1.8L1.85 8l1.6-.95-.35-1.8 1.75-.5.5-1.75 1.8.35z" />
    </>
  ),
  // Worktree split: one trunk branching into two.
  split: (
    <>
      <circle cx="4" cy="3.25" r="1.5" />
      <circle cx="12" cy="3.25" r="1.5" />
      <circle cx="4" cy="12.75" r="1.5" />
      <path d="M4 4.75v6.5M12 4.75v1.5a2.5 2.5 0 01-2.5 2.5h-3A2.5 2.5 0 004 11.25" />
    </>
  ),
  // Pinned / permanent workspace.
  pin: <path d="M8 1.75l1.9 3.85 4.25.62-3.07 3-.73 4.23L8 11.45l-3.8 2-.73-4.23-3.07-3 4.25-.62z" />,
  close: <path d="M4.25 4.25l7.5 7.5M11.75 4.25l-7.5 7.5" />,
  plus: <path d="M8 3.5v9M3.5 8h9" />,
  // Palette: "go somewhere" vs "do something".
  arrow: <path d="M6 3.5L10.5 8 6 12.5" />,
  bolt: <path d="M8.75 1.75L3.5 9h3.75l-.5 5.25L12.5 7H8.25z" />,

  /* Dashboard pages. One per tab, so a glance at the strip is enough to find
     the page you want without reading it. */
  home: <path d="M2.5 7.25L8 2.75l5.5 4.5v5.25a.75.75 0 01-.75.75H9.75V9.5h-3.5v3.75H3.25a.75.75 0 01-.75-.75z" />,
  check: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M5.5 8.25l1.85 1.85L10.6 6.5" />
    </>
  ),
  target: (
    <>
      <circle cx="8" cy="8" r="6" />
      <circle cx="8" cy="8" r="2.75" />
      <path d="M8 7.9h.01" />
    </>
  ),
  flame: <path d="M8 1.5c.6 2.1 2.3 3 3 4.6.9 1.9.5 4.2-1.1 5.5-1.3 1-3.2 1-4.4-.2C4.2 10.1 4.3 7.6 5.6 6c.3 1 .8 1.6 1.4 1.9C6.3 6 6.7 3.4 8 1.5z" />,
  briefcase: (
    <>
      <rect x="2" y="4.75" width="12" height="8.5" rx="1.75" />
      <path d="M5.75 4.75V3.6A1.35 1.35 0 017.1 2.25h1.8A1.35 1.35 0 0110.25 3.6v1.15M2 8.25h12" />
    </>
  ),
  wallet: (
    <>
      <rect x="2" y="3.5" width="12" height="9" rx="2" />
      <path d="M2 6.75h12" />
      <path d="M11 9.6h.01" />
    </>
  ),
  note: (
    <>
      <path d="M4 2.5h5.25L13 6.25v7.25H4z" />
      <path d="M9.1 2.5v3.6H13M6.25 8.75h4M6.25 10.9h2.75" />
    </>
  ),
  calendar: (
    <>
      <rect x="2.25" y="3.5" width="11.5" height="10.25" rx="1.75" />
      <path d="M2.25 6.9h11.5M5.5 2.25v2.5M10.5 2.25v2.5" />
    </>
  ),
  chat: <path d="M13.5 9.5a2 2 0 01-2 2H6.25L3 13.75V4.5a2 2 0 012-2h6.5a2 2 0 012 2z" />,
  spark: <path d="M8 1.75l1.55 4.7 4.7 1.55-4.7 1.55L8 14.25 6.45 9.55 1.75 8l4.7-1.55z" />,
  chart: <path d="M2.75 13.25h10.5M5 11V7.25M8 11V3.5M11 11V8.25" />
}

/** Which icon stands for a dashboard page, keyed by the pane kind it shows. */
export const PAGE_ICONS: Record<string, keyof typeof paths> = {
  home: 'home',
  todo: 'check',
  goals: 'target',
  habits: 'flame',
  business: 'briefcase',
  finance: 'wallet',
  notes: 'note',
  calendar: 'calendar',
  tracker: 'chat',
  terminal: 'spark',
  browser: 'arrow',
  merge: 'split'
}

export function Icon({
  name,
  size = 14,
  className
}: {
  name: keyof typeof paths
  size?: number
  className?: string
}) {
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}
