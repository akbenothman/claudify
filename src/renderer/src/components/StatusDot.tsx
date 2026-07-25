import type { PaneStatus } from '../store'

/**
 * Working / needs-you / done / done-and-checked.
 *
 * Colour is a NOTIFICATION, not a readout. A lit dot always means "there is
 * something here you have not looked at yet"; the moment you look at the tab,
 * the colour drains out of it even though the underlying state is unchanged.
 * That is why both your-turn states collapse to the same hollow ring once seen —
 * an agent waiting on a permission you've already seen must not keep shouting
 * across the whole app.
 *
 *   working              calm blue pulse      — busy, don't bother looking yet
 *   blocked   (unseen)   amber pulse          — needs you, and you HAVEN'T looked
 *   finished  (unseen)   solid green + halo   — done, and you HAVEN'T looked
 *   blocked/finished     hollow grey ring     — you've already looked
 *     (seen)
 *
 * The tooltip stays honest in every case: it names the real state, checked or
 * not, so a readout (the status bar, the palette) still tells you the truth.
 */
export function StatusDot({
  status,
  unseen,
  label
}: {
  status?: PaneStatus
  unseen?: boolean
  label?: boolean
}) {
  const s = status ?? 'idle'
  if (s === 'idle' && !unseen && !label) return null

  // Both "blocked" and "finished" are your-turn states, and both stop being news
  // once you've been to the tab.
  const yourTurn = s === 'blocked' || s === 'finished'
  const state = yourTurn && !unseen ? 'seen' : s
  const title =
    s === 'working'
      ? 'working…'
      : s === 'blocked'
        ? unseen
          ? 'needs you — waiting on your approval'
          : 'waiting on your approval — checked'
        : s === 'finished'
          ? unseen
            ? 'finished — you haven’t checked this yet'
            : 'finished — checked'
          : unseen
            ? 'something here to check'
            : 'idle'

  return (
    <span className={`dot dot-${state}${unseen ? ' unseen' : ''}`} title={title}>
      {label && <span className="dot-label">{title}</span>}
    </span>
  )
}
