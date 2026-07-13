import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'

// Deliberately no StrictMode: its double-invoked effects would spawn, kill and
// respawn a PTY for every pane on mount.
createRoot(document.getElementById('root')!).render(<App />)
