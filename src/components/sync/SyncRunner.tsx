import { useEffect } from 'react'
import { startAutoSync, stopAutoSync } from '../../backup/autoSync'

// Headless — starts/stops the auto-sync listeners (mutation debounce, visibilitychange, poll) for
// the lifetime of the app shell. Mounted once in App.tsx, outside the router so it survives
// navigation between pages.
export function SyncRunner() {
  useEffect(() => {
    startAutoSync()
    return () => stopAutoSync()
  }, [])
  return null
}
