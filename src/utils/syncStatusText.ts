import type { SyncStatus } from '../store/syncStore'

export function formatRelativeTime(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return 'agora mesmo'
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `há ${hours}h`
  return `há ${Math.floor(hours / 24)}d`
}

// Shared between BackupPage's sync card and Sidebar's footer status line, so both read the same
// wording for a given useSyncStore state.
export function syncStatusText(status: SyncStatus, lastSyncedAt: string | null, errorMessage: string | null): string {
  switch (status) {
    case 'syncing':
      return 'Sincronizando...'
    case 'pending-auth':
      return 'Sincronização pendente — toque em qualquer lugar do app para autorizar.'
    case 'error':
      return errorMessage ?? 'Erro ao sincronizar.'
    default:
      return lastSyncedAt ? `Sincronizado ${formatRelativeTime(lastSyncedAt)}` : 'Ainda não sincronizado'
  }
}
