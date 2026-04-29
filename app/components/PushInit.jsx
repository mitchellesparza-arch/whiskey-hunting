'use client'
import { useEffect } from 'react'

/**
 * Registers the service worker on mount.
 * Rendered once in layout — no visible UI.
 */
export default function PushInit() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .catch(err => console.warn('[sw] registration failed:', err))
    }
  }, [])

  return null
}
