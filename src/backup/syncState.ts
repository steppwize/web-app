// Device-local auto-sync state, kept in localStorage — deliberately outside Postgres, because a
// restore replaces the whole PGlite data dir and this state (which device this is, whether it has
// unsynced local changes, what the last-synced version was) must survive that. Pure module, no
// React, and safe to import before db/client boots (see main.tsx's restore-first ordering).
const STORAGE_KEY = 'steppwize.sync'

export interface SyncState {
  autoSyncEnabled: boolean
  deviceId: string
  deviceName: string
  // Mirrors googleAuth's in-memory hasGrantedBefore across reloads, so silent prompt:'' renewal
  // still works after a refresh without re-showing the consent screen.
  grantedBefore: boolean
  autosaveFileId: string | null
  lastSyncedSeq: number
  lastSyncedAt: string | null
  lastDatedCopyDay: string | null // yyyy-mm-dd, local date of the last once-a-day history copy
  dirty: boolean
}

function defaultDeviceName(): string {
  const ua = navigator.userAgent
  if (/iPhone|iPad/.test(ua)) return 'iPhone/iPad'
  if (/Android/.test(ua)) return 'Android'
  if (/Mac OS X/.test(ua)) return 'Mac'
  if (/Windows/.test(ua)) return 'Windows'
  if (/Linux/.test(ua)) return 'Linux'
  return 'Dispositivo'
}

function defaults(): SyncState {
  return {
    autoSyncEnabled: false,
    deviceId: crypto.randomUUID(),
    deviceName: defaultDeviceName(),
    grantedBefore: false,
    autosaveFileId: null,
    lastSyncedSeq: 0,
    lastSyncedAt: null,
    lastDatedCopyDay: null,
    dirty: false,
  }
}

let cached: SyncState | null = null

export function getSyncState(): SyncState {
  if (cached) return cached
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    cached = raw ? { ...defaults(), ...(JSON.parse(raw) as Partial<SyncState>) } : defaults()
  } catch {
    cached = defaults()
  }
  // Persist immediately so a freshly generated deviceId doesn't change again on the next read.
  saveSyncState(cached)
  return cached
}

export function saveSyncState(state: SyncState): void {
  cached = state
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Best-effort — a full-disk/private-browsing localStorage write failure shouldn't crash sync;
    // it just means state won't survive a reload.
  }
}

export function updateSyncState(patch: Partial<SyncState>): SyncState {
  const next = { ...getSyncState(), ...patch }
  saveSyncState(next)
  return next
}
