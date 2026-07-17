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
  bolt: <path d="M8.75 1.75L3.5 9h3.75l-.5 5.25L12.5 7H8.25z" />
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
