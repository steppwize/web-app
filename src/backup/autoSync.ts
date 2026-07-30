// Orchestrates automatic backup of the local Postgres data dir to a single fixed file in Google
// Drive ("autosave"), separate from the dated manual backups in backup/googleDrive.ts. See the
// "Auto-sync do banco local com o Google Drive" plan for the model this implements:
//   - one autosave file, overwritten in place, versioned by an appProperties.seq counter
//   - push on mutation (debounced), pull on focus/boot when it's safe (no local unsynced changes)
//   - conflict (both sides changed) never auto-resolves: it snapshots both sides and asks the user
// This module has no React dependency — it's driven by App.tsx's MutationCache and a small
// <SyncRunner> effect, and read by the Zustand store in ../store/syncStore for UI.
import {
  getAccessToken,
  getAccessTokenSilent,
  hydrateGrantedBefore,
  renewTokenFromGesture,
  tokenExpiresInMs,
} from './googleAuth'
import {
  copyAutosaveToDated,
  createAutosave,
  downloadBackup,
  findAutosaveFile,
  getAutosaveMeta,
  updateAutosave,
  uploadBackup,
  type AutosaveProps,
} from './googleDrive'
import { createBackupBlob } from './export'
import { restoreBackup } from './restore'
import { getSyncState, updateSyncState } from './syncState'
import { useSyncStore } from '../store/syncStore'
import { useToastStore } from '../store/toastStore'

const DEBOUNCE_MS = 30_000
const MIN_UPLOAD_GAP_MS = 3 * 60_000
const POLL_MS = 5 * 60_000
const FOCUS_THROTTLE_MS = 60_000
const GESTURE_RENEWAL_THRESHOLD_MS = 5 * 60_000

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null
let lastUploadAttemptAt = 0
let lastRemoteCheckAt = 0
let running = false
let inFlight: Promise<void> | null = null

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function todayLocalDate(): string {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function datedBackupName(now: Date): string {
  return `steppwize-backup-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.tar.gz`
}

function conflictSnapshotName(deviceName: string): string {
  const now = new Date()
  const safeName = deviceName.replace(/[^a-zA-Z0-9]+/g, '-')
  return `steppwize-conflito-${safeName}-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.tar.gz`
}

// Once a day, on top of overwriting the autosave slot, keep a dated copy for history — reuses the
// existing file content via Drive's copy API instead of a second upload.
async function maybeCopyDatedHistory(fileId: string): Promise<void> {
  const today = todayLocalDate()
  if (getSyncState().lastDatedCopyDay === today) return
  try {
    await copyAutosaveToDated(fileId, datedBackupName(new Date()))
    updateSyncState({ lastDatedCopyDay: today })
  } catch {
    // Best-effort daily history copy — must not fail the autosave push itself.
  }
}

async function doPush(interactive: boolean): Promise<void> {
  const store = useSyncStore.getState()
  store.setStatus('syncing')
  lastUploadAttemptAt = Date.now()
  try {
    const token = interactive ? await getAccessToken() : getAccessTokenSilent()
    if (!token) {
      store.setStatus('pending-auth')
      return
    }

    let state = getSyncState()
    let fileId = state.autosaveFileId
    if (!fileId) {
      fileId = await findAutosaveFile()
      if (fileId) state = updateSyncState({ autosaveFileId: fileId })
    }

    if (fileId) {
      const meta = await getAutosaveMeta(fileId)
      const remoteSeq = Number(meta.appProperties.seq ?? '0')
      if (remoteSeq !== state.lastSyncedSeq) {
        useSyncStore.getState().setConflict({
          autosaveFileId: fileId,
          remoteSeq,
          remoteDeviceName: meta.appProperties.deviceName ?? 'outro dispositivo',
        })
        return
      }
    }

    const { blob } = await createBackupBlob()
    const nextSeq = state.lastSyncedSeq + 1
    const props: AutosaveProps = {
      seq: String(nextSeq),
      deviceId: state.deviceId,
      deviceName: state.deviceName,
      savedAt: new Date().toISOString(),
    }

    if (fileId) {
      await updateAutosave(fileId, blob, props)
    } else {
      fileId = await createAutosave(blob, props)
    }

    await maybeCopyDatedHistory(fileId)

    const now = new Date().toISOString()
    updateSyncState({
      autosaveFileId: fileId,
      lastSyncedSeq: nextSeq,
      lastSyncedAt: now,
      dirty: false,
      grantedBefore: true,
    })
    hydrateGrantedBefore(true)
    useSyncStore.getState().setLastSyncedAt(now)
    useSyncStore.getState().setStatus('idle')
  } catch (error) {
    useSyncStore.getState().setError(error instanceof Error ? error.message : 'Falha ao sincronizar com o Google Drive.')
  }
}

// Enforces the minimum gap between actual uploads even if markDirty() keeps firing — the debounce
// timer alone only guarantees 30s of inactivity, not a floor between successive uploads while the
// user keeps editing.
function pushWithGap(interactive: boolean): Promise<void> {
  const elapsed = Date.now() - lastUploadAttemptAt
  if (elapsed < MIN_UPLOAD_GAP_MS && lastUploadAttemptAt > 0) {
    return new Promise((resolve) => {
      debounceTimer = setTimeout(() => {
        debounceTimer = null
        resolve(pushWithGap(interactive))
      }, MIN_UPLOAD_GAP_MS - elapsed)
    })
  }
  return syncNow({ interactive })
}

export function syncNow(opts: { interactive: boolean } = { interactive: true }): Promise<void> {
  const state = getSyncState()
  if (!state.autoSyncEnabled) return Promise.resolve()
  if (inFlight) return inFlight
  inFlight = doPush(opts.interactive).finally(() => {
    inFlight = null
  })
  return inFlight
}

// Called from the app's MutationCache onSuccess — every successful write marks state dirty and
// schedules a debounced background push.
export function markDirty(): void {
  const state = getSyncState()
  if (!state.autoSyncEnabled) return
  updateSyncState({ dirty: true })
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    void pushWithGap(false)
  }, DEBOUNCE_MS)
}

export async function pullRemote(fileId: string): Promise<void> {
  const meta = await getAutosaveMeta(fileId)
  const remoteSeq = Number(meta.appProperties.seq ?? '0')
  const blob = await downloadBackup(fileId)
  const file = new File([blob], 'steppwize-autosave.tar.gz')
  updateSyncState({
    autosaveFileId: fileId,
    lastSyncedSeq: remoteSeq,
    lastSyncedAt: new Date().toISOString(),
    dirty: false,
  })
  useToastStore.getState().show('Dados atualizados a partir de outro dispositivo.')
  // Reloads the page once applied — restoreBackup never returns to an "after" state.
  await restoreBackup(file)
}

// Cheap metadata-only check for whether another device has written a newer autosave. Never opens
// a popup — background checks must not surprise the user with a Google auth window.
export async function checkRemote(): Promise<void> {
  const state = getSyncState()
  if (!state.autoSyncEnabled) return
  if (inFlight) return
  const now = Date.now()
  if (now - lastRemoteCheckAt < FOCUS_THROTTLE_MS) return
  lastRemoteCheckAt = now

  try {
    const token = getAccessTokenSilent()
    if (!token) return

    let fileId = state.autosaveFileId
    if (!fileId) {
      fileId = await findAutosaveFile()
      if (!fileId) return
      updateSyncState({ autosaveFileId: fileId })
    }

    const meta = await getAutosaveMeta(fileId)
    const remoteSeq = Number(meta.appProperties.seq ?? '0')
    if (remoteSeq <= state.lastSyncedSeq) return

    if (!state.dirty) {
      await pullRemote(fileId)
      return
    }

    useSyncStore.getState().setConflict({
      autosaveFileId: fileId,
      remoteSeq,
      remoteDeviceName: meta.appProperties.deviceName ?? 'outro dispositivo',
    })
  } catch {
    // Background checks fail silently — syncNow() surfaces real problems the next time it runs.
  }
}

export async function resolveConflict(choice: 'local' | 'remote'): Promise<void> {
  const conflict = useSyncStore.getState().conflict
  if (!conflict) return
  useSyncStore.getState().setConflict(null)
  useSyncStore.getState().setStatus('syncing')
  const state = getSyncState()

  try {
    if (choice === 'remote') {
      // About to discard local changes in favor of the remote version — snapshot them first as a
      // dated backup so nothing is silently lost. Uploaded as a normal dated file, not the
      // autosave slot (which is about to be pulled from, not written to).
      const { blob } = await createBackupBlob()
      await uploadBackup(blob, conflictSnapshotName(state.deviceName))
      await pullRemote(conflict.autosaveFileId)
      return
    }

    // choice === 'local': about to overwrite the remote autosave — snapshot its current content
    // before overwriting it.
    await copyAutosaveToDated(conflict.autosaveFileId, conflictSnapshotName(conflict.remoteDeviceName))

    const nextSeq = conflict.remoteSeq + 1
    const { blob } = await createBackupBlob()
    const props: AutosaveProps = {
      seq: String(nextSeq),
      deviceId: state.deviceId,
      deviceName: state.deviceName,
      savedAt: new Date().toISOString(),
    }
    await updateAutosave(conflict.autosaveFileId, blob, props)

    const now = new Date().toISOString()
    updateSyncState({ lastSyncedSeq: nextSeq, lastSyncedAt: now, dirty: false })
    useSyncStore.getState().setLastSyncedAt(now)
    useSyncStore.getState().setStatus('idle')
  } catch (error) {
    useSyncStore
      .getState()
      .setError(error instanceof Error ? error.message : 'Falha ao resolver conflito de sincronização.')
  }
}

// Runs inside a capture-phase pointerdown handler so the popup (if GIS decides it needs one) is
// never blocked — it's still inside a real user gesture. Most of the time, with prompt: '' and an
// existing grant, GIS reissues a token with no visible UI at all.
function handleGesture(): void {
  const state = getSyncState()
  if (!state.autoSyncEnabled) return
  const remaining = tokenExpiresInMs()
  if (remaining !== null && remaining > GESTURE_RENEWAL_THRESHOLD_MS) return
  void renewTokenFromGesture().then((token) => {
    if (token) updateSyncState({ grantedBefore: true })
  })
}

function handleVisibilityChange(): void {
  if (document.visibilityState === 'visible') {
    void checkRemote()
  } else if (getSyncState().dirty) {
    // Best-effort flush on hide — fires but is never awaited by the browser.
    void syncNow({ interactive: false })
  }
}

export function startAutoSync(): void {
  const state = getSyncState()
  hydrateGrantedBefore(state.grantedBefore)
  if (!state.autoSyncEnabled) {
    useSyncStore.getState().setStatus('off')
    return
  }
  useSyncStore.getState().setStatus('idle')
  if (state.lastSyncedAt) useSyncStore.getState().setLastSyncedAt(state.lastSyncedAt)
  if (running) return
  running = true

  document.addEventListener('pointerdown', handleGesture, true)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  pollTimer = setInterval(() => {
    if (document.visibilityState === 'visible') void checkRemote()
  }, POLL_MS)

  void checkRemote()
}

export function stopAutoSync(): void {
  running = false
  document.removeEventListener('pointerdown', handleGesture, true)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  useSyncStore.getState().setStatus('off')
}

// Turning the toggle on: request a token interactively (so the popup, if any, is attributable to
// this exact click) before persisting autoSyncEnabled, so a cancelled/denied grant doesn't leave
// the feature silently "on" with no way to actually sync.
export async function enableAutoSync(): Promise<void> {
  await getAccessToken()
  updateSyncState({ autoSyncEnabled: true, grantedBefore: true })
  hydrateGrantedBefore(true)
  startAutoSync()
  await syncNow({ interactive: true })
}

export function disableAutoSync(): void {
  updateSyncState({ autoSyncEnabled: false })
  stopAutoSync()
}
