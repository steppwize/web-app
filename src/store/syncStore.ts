import { create } from 'zustand'

export type SyncStatus = 'off' | 'idle' | 'syncing' | 'pending-auth' | 'error' | 'conflict'

export interface SyncConflict {
  autosaveFileId: string
  remoteSeq: number
  remoteDeviceName: string
}

interface SyncStoreState {
  status: SyncStatus
  lastSyncedAt: string | null
  errorMessage: string | null
  conflict: SyncConflict | null
  setStatus: (status: SyncStatus) => void
  setLastSyncedAt: (iso: string | null) => void
  setError: (message: string) => void
  setConflict: (conflict: SyncConflict | null) => void
}

export const useSyncStore = create<SyncStoreState>((set) => ({
  status: 'off',
  lastSyncedAt: null,
  errorMessage: null,
  conflict: null,
  setStatus: (status) => set((state) => ({ status, errorMessage: status === 'error' ? state.errorMessage : null })),
  setLastSyncedAt: (iso) => set({ lastSyncedAt: iso }),
  setError: (message) => set({ status: 'error', errorMessage: message }),
  setConflict: (conflict) => set({ conflict, status: conflict ? 'conflict' : 'idle' }),
}))
