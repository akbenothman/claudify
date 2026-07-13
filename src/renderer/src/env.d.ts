/// <reference types="vite/client" />
import type { ClaudifyApi } from '../../preload'

declare global {
  interface Window {
    claudify: ClaudifyApi
  }
}

export {}
