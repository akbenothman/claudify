/**
 * Drag payload for tabs.
 *
 * A custom MIME type matters: `dataTransfer.types` is the only thing readable
 * during `dragover` (the payload is withheld until drop), so drop targets use it
 * to decide whether they should light up at all.
 */
export const TAB_MIME = 'application/x-claudify-tab'
export const WS_MIME = 'application/x-claudify-workspace'

export interface TabDrag {
  wsId: string
  tabId: string
}

export interface WorkspaceDrag {
  index: number
}
