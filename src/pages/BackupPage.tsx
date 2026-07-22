import { useRef, useState } from 'react'
import { ChevronLeft, Download, Upload } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { exportBackup } from '../backup/export'
import { restoreBackup } from '../backup/restore'
import { useToastStore } from '../store/toastStore'

export function BackupPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleExport() {
    setBusy(true)
    try {
      await exportBackup()
    } catch (error) {
      useToastStore.getState().show(error instanceof Error ? error.message : 'Falha ao exportar backup.')
    } finally {
      setBusy(false)
    }
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) setPendingFile(file)
  }

  async function handleConfirmRestore() {
    if (!pendingFile) return
    setBusy(true)
    try {
      // Reloads the page once applied — there is no "after" state to return to here.
      await restoreBackup(pendingFile)
    } catch (error) {
      useToastStore.getState().show(error instanceof Error ? error.message : 'Falha ao restaurar backup.')
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8 max-w-xl">
      <div className="flex items-center gap-2.5">
        <button onClick={() => navigate(-1)}>
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-xl font-bold">Backup dos dados</h1>
      </div>

      <p className="text-sm text-muted">
        Todos os seus dados ficam salvos apenas neste dispositivo. Exporte um arquivo de backup periodicamente e
        guarde-o em local seguro (ex: Google Drive).
      </p>

      <div className="flex flex-col gap-3 p-4 rounded-2xl bg-card border border-border">
        <h2 className="text-sm font-semibold">Exportar</h2>
        <p className="text-xs text-muted">Baixa um arquivo .tar.gz com todos os seus dados.</p>
        <button
          onClick={handleExport}
          disabled={busy}
          className="self-start flex items-center gap-2 h-10 px-4 rounded-[10px] bg-brand text-sm font-semibold disabled:opacity-60"
        >
          <Download size={16} /> Exportar backup
        </button>
      </div>

      <div className="flex flex-col gap-3 p-4 rounded-2xl bg-card border border-border">
        <h2 className="text-sm font-semibold">Restaurar</h2>
        <p className="text-xs text-muted">
          Substitui <span className="font-semibold text-white">todos</span> os dados atuais pelo conteúdo do
          arquivo e recarrega a página. Essa ação não pode ser desfeita.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".tar.gz,.tgz"
          className="hidden"
          onChange={handleFileSelected}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          className="self-start flex items-center gap-2 h-10 px-4 rounded-[10px] bg-surface border border-border text-sm font-semibold disabled:opacity-60"
        >
          <Upload size={16} /> Selecionar arquivo de backup
        </button>
      </div>

      {pendingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-card p-5 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <h2 className="text-base font-bold">Restaurar backup</h2>
              <p className="text-sm text-muted">
                Isso vai apagar todos os dados atuais e substituí-los pelo conteúdo de{' '}
                <span className="font-semibold text-white">{pendingFile.name}</span>. Essa ação não pode ser
                desfeita.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setPendingFile(null)}
                disabled={busy}
                className="h-9 px-4 rounded-lg text-sm font-semibold text-muted disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmRestore}
                disabled={busy}
                className="h-9 px-4 rounded-lg text-sm font-semibold bg-brand disabled:opacity-60"
              >
                {busy ? 'Restaurando...' : 'Restaurar e substituir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
