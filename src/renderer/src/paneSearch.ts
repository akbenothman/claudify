/**
 * A registry of scrollback-search handles, keyed by pane id — the same "each
 * pane registers a callback the rest of the app can reach" pattern as
 * `paneInput`. TerminalPane registers its xterm SearchAddon here on mount; the
 * global search bar (App) drives whichever pane is focused, so the search UI
 * never has to know anything about xterm internals.
 */
export interface SearchApi {
  findNext: (query: string) => void
  findPrevious: (query: string) => void
  clear: () => void
}

const registry = new Map<string, SearchApi>()

export function registerSearch(paneId: string, api: SearchApi): void {
  registry.set(paneId, api)
}

export function unregisterSearch(paneId: string): void {
  registry.delete(paneId)
}

export function getSearch(paneId: string): SearchApi | undefined {
  return registry.get(paneId)
}
