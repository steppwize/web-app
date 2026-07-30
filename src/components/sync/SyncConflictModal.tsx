import { useState } from 'react'
import { resolveConflict } from '../../backup/autoSync'
import { useSyncStore } from '../../store/syncStore'
import { useToastStore } from '../../store/toastStore'

// Global — a conflict can be detected on any page (boot check, focus check, or a background push),
// so this is mounted once in App.tsx alongside <ToastHost />, not on a specific route.
export function SyncConflictModal() {
  const conflict = useSyncStore((s) => s.conflict)
  const [busy, setBusy] = useState(false)

  if (!conflict) return null

  async function handleChoice(choice: 'local' | 'remote') {
    setBusy(true)
    try {
      await resolveConflict(choice)
    } catch (error) {
      useToastStore.getState().show(error instanceof Error ? error.message : 'Falha ao resolver conflito.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-card p-5 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-base font-bold">Dados mais recentes em outro dispositivo</h2>
          <p className="text-sm text-muted">
            <span className="font-semibold text-white">{conflict.remoteDeviceName}</span> salvou alterações no
            Google Drive depois da última sincronização deste dispositivo, que também tem alterações não
            sincronizadas. Escolha quais dados manter — a versão descartada é enviada como um backup separado
            antes de ser substituída, então nada se perde de verdade.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => handleChoice('local')}
            disabled={busy}
            className="h-10 px-4 rounded-[10px] bg-brand text-sm font-semibold disabled:opacity-60"
          >
            Usar os dados deste dispositivo
          </button>
          <button
            onClick={() => handleChoice('remote')}
            disabled={busy}
            className="h-10 px-4 rounded-[10px] bg-surface border border-border text-sm font-semibold disabled:opacity-60"
          >
            Usar os dados do outro dispositivo
          </button>
        </div>
      </div>
    </div>
  )
}
