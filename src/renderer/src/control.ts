import { findPane, useStore } from './store'
import { sendToPane } from './paneInput'
import type { ControlRequest } from '../../shared/types'

/**
 * Executes one control-surface request in the renderer, then reports the
 * outcome back to the main process so it can be written into control.json.
 *
 * The renderer runs this — not main — because the panes, their status, and
 * their input all live here. Main only forwards the request and records what we
 * say happened.
 */
export function handleControlRequest(req: ControlRequest): void {
  const done = (ok: boolean, message: string) =>
    window.claudify.resolveControl(req.id, ok, message)

  try {
    if (req.action === 'notify') {
      window.claudify.notify(req.title || 'Claudify', req.body || '')
      return done(true, 'notified')
    }

    // Every other action targets a pane by `match`.
    if (!req.match) return done(false, 'match is required')
    const hit = findPane(useStore.getState(), req.match)
    if (!hit) return done(false, `no pane matching "${req.match}"`)
    const { wsId, tabId, paneId, pane } = hit
    const s = useStore.getState()

    if (req.action === 'status') {
      if (!req.state) return done(false, 'state is required')
      s.setPaneStatus(wsId, tabId, paneId, req.state)
      return done(true, `set ${pane.title} to ${req.state}`)
    }

    if (req.action === 'message') {
      if (!req.text) return done(false, 'text is required')
      if (!sendToPane(paneId, req.text)) return done(false, `${pane.title} has no live terminal`)
      return done(true, `typed into ${pane.title}`)
    }

    if (req.action === 'focus') {
      s.setActiveWorkspace(wsId)
      s.setActiveTab(wsId, tabId)
      s.setActivePane(wsId, tabId, paneId)
      return done(true, `focused ${pane.title}`)
    }

    done(false, `unknown action "${req.action}"`)
  } catch (e) {
    done(false, (e as Error).message)
  }
}
