import { useEffect, useState } from 'react'
import type { Settings, ShellInfo } from '../../../shared/types'

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const [shells, setShells] = useState<ShellInfo[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)

  useEffect(() => {
    Promise.all([window.claudify.detectShells(), window.claudify.getSettings()]).then(([sh, st]) => {
      setShells(sh)
      setSettings(st)
    })
  }, [])

  const update = async (patch: Partial<Settings>) => {
    const next = await window.claudify.saveSettings(patch)
    setSettings(next)
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal modal-sm" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <strong>Settings</strong>
          <button className="pane-x" onClick={onClose}>
            ×
          </button>
        </div>

        <label>Shell</label>
        {!settings ? (
          <div className="hint">loading…</div>
        ) : shells.length === 0 ? (
          <div className="error">No shells detected on this machine.</div>
        ) : (
          <div className="shell-list">
            {shells.map((s) => (
              <button
                key={s.id}
                className={`shell${settings.shellId === s.id ? ' active' : ''}`}
                onClick={() => update({ shellId: s.id })}
              >
                <span className="shell-label">{s.label}</span>
                <span className="shell-path">{s.path}</span>
                {settings.shellId === s.id && <span className="shell-check">✓</span>}
              </button>
            ))}
          </div>
        )}
        <div className="hint">
          Applies to terminals you open from now on. Shells already running keep going.
        </div>

        <label>Startup</label>
        <button
          className={`shell toggle${settings?.launchAtLogin ? ' active' : ''}`}
          disabled={!settings}
          onClick={() => update({ launchAtLogin: !settings?.launchAtLogin })}
        >
          <span className="shell-label">Open Claudify when I log in to Windows</span>
          <span className="shell-check">{settings?.launchAtLogin ? '✓' : ''}</span>
        </button>
        <div className="hint">Takes effect for the installed app.</div>

        <div className="modal-actions">
          <button className="primary" onClick={onClose}>
            done
          </button>
        </div>
      </div>
    </div>
  )
}
