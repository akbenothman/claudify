import type { PaneStatus } from '../store'

/**
 * Working / finished / finished-but-unchecked.
 *
 * The three states have to be tellable apart in peripheral vision:
 *   working           calm blue pulse      — busy, don't bother looking yet
 *   finished (seen)   hollow grey ring     — done, and you've already looked
 *   finished (unseen) solid green + halo   — done, and you HAVEN'T looked
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

  const state = s === 'finished' && !unseen ? 'seen' : s
  const title =
    s === 'working'
      ? 'working…'
      : unseen
        ? 'finished — you haven’t checked this yet'
        : s === 'finished'
          ? 'finished — checked'
          : 'idle'

  return (
    <span className={`dot dot-${state}${unseen ? ' unseen' : ''}`} title={title}>
      {label && <span className="dot-label">{title}</span>}
    </span>
  )
}
