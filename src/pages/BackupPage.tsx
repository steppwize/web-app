import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, CloudUpload, Download, RefreshCw, Trash2, Upload, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { createBackupBlob, exportBackup } from '../backup/export'
import { restoreBackup } from '../backup/restore'
import { isDriveConfigured } from '../backup/googleAuth'
import { deleteBackup, downloadBackup, listBackups, uploadBackup, type DriveBackup } from '../backup/googleDrive'
import { useToastStore } from '../store/toastStore'

type PendingRestore = { source: 'local'; file: File } | { source: 'drive'; id: string; name: string }

export function BackupPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingRestore, setPendingRestore] = useState<PendingRestore | null>(null)
  const [busy, setBusy] = useState(false)
  const [uploadingToDrive, setUploadingToDrive] = useState(false)
  const [driveListOpen, setDriveListOpen] = useState(false)

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
    if (!file) return
    if (!/\.(tar\.gz|tgz)$/i.test(file.name)) {
      useToastStore.getState().show('Selecione um arquivo .tar.gz ou .tgz.')
      return
    }
    setPendingRestore({ source: 'local', file })
  }

  async function handleUploadToDrive() {
    setUploadingToDrive(true)
    try {
      const { blob, filename } = await createBackupBlob()
      await uploadBackup(blob, filename)
      useToastStore.getState().show('Backup enviado para o Google Drive.')
      queryClient.invalidateQueries({ queryKey: ['drive-backups'] })
    } catch (error) {
      useToastStore
        .getState()
        .show(error instanceof Error ? error.message : 'Falha ao enviar backup para o Google Drive.')
    } finally {
      setUploadingToDrive(false)
    }
  }

  async function handleDeleteDriveBackup(backup: DriveBackup) {
    try {
      await deleteBackup(backup.id)
      queryClient.invalidateQueries({ queryKey: ['drive-backups'] })
    } catch (error) {
      useToastStore.getState().show(error instanceof Error ? error.message : 'Falha ao remover backup.')
    }
  }

  async function handleConfirmRestore() {
    if (!pendingRestore) return
    setBusy(true)
    try {
      const file =
        pendingRestore.source === 'local'
          ? pendingRestore.file
          : new File([await downloadBackup(pendingRestore.id)], pendingRestore.name)
      // Reloads the page once applied — there is no "after" state to return to here.
      await restoreBackup(file)
    } catch (error) {
      useToastStore.getState().show(error instanceof Error ? error.message : 'Falha ao restaurar backup.')
      setBusy(false)
    }
  }

  const pendingRestoreName = pendingRestore?.source === 'local' ? pendingRestore.file.name : pendingRestore?.name

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8 max-w-xl">
      <div className="flex items-center gap-2.5">
        <button onClick={() => navigate(-1)}>
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-xl font-bold">Backup dos dados</h1>
      </div>

      <p className="text-sm text-muted">
        Todos os seus dados ficam salvos apenas neste dispositivo. Exporte um arquivo de backup periodicamente
        e guarde-o em local seguro, ou envie diretamente para o Google Drive.
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

      {isDriveConfigured && (
        <div className="flex flex-col gap-3 p-4 rounded-2xl bg-card border border-border">
          <h2 className="text-sm font-semibold">Google Drive</h2>
          <p className="text-xs text-muted">
            Envia um backup para uma pasta "Steppwize Backups" no seu Google Drive. Os 10 backups mais
            recentes são mantidos; os mais antigos são removidos automaticamente.
          </p>
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleUploadToDrive}
              disabled={uploadingToDrive}
              className="flex items-center gap-2 h-10 px-4 rounded-[10px] bg-brand text-sm font-semibold disabled:opacity-60"
            >
              <CloudUpload size={16} /> {uploadingToDrive ? 'Enviando...' : 'Enviar para o Drive'}
            </button>
            <button
              onClick={() => setDriveListOpen(true)}
              className="flex items-center gap-2 h-10 px-4 rounded-[10px] bg-surface border border-border text-sm font-semibold"
            >
              Ver backups
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 p-4 rounded-2xl bg-card border border-border">
        <h2 className="text-sm font-semibold">Restaurar</h2>
        <p className="text-xs text-muted">
          Substitui <span className="font-semibold text-white">todos</span> os dados atuais pelo conteúdo do
          arquivo e recarrega a página. Essa ação não pode ser desfeita.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".tar.gz,.tgz,.gz,application/gzip,application/x-gzip"
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

      {driveListOpen && (
        <DriveBackupsModal
          onClose={() => setDriveListOpen(false)}
          onSelect={(backup) => {
            setDriveListOpen(false)
            setPendingRestore({ source: 'drive', id: backup.id, name: backup.name })
          }}
          onDelete={handleDeleteDriveBackup}
        />
      )}

      {pendingRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-card p-5 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <h2 className="text-base font-bold">Restaurar backup</h2>
              <p className="text-sm text-muted">
                Isso vai apagar todos os dados atuais e substituí-los pelo conteúdo de{' '}
                <span className="font-semibold text-white">{pendingRestoreName}</span>. Essa ação não pode ser
                desfeita.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setPendingRestore(null)}
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

function formatBackupSize(bytes: string): string {
  const n = Number(bytes)
  if (!Number.isFinite(n)) return ''
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function DriveBackupsModal({
  onClose,
  onSelect,
  onDelete,
}: {
  onClose: () => void
  onSelect: (backup: DriveBackup) => void
  onDelete: (backup: DriveBackup) => void
}) {
  const { data: backups, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['drive-backups'],
    queryFn: listBackups,
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm max-h-[70vh] rounded-2xl bg-card p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold">Backups no Google Drive</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              aria-label="Atualizar lista"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-muted bg-surface disabled:opacity-60"
            >
              <RefreshCw size={14} />
            </button>
            <button
              onClick={onClose}
              aria-label="Fechar"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-muted bg-surface"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col gap-2">
          {isLoading && <p className="text-sm text-muted text-center py-4">Carregando...</p>}
          {isError && <p className="text-sm text-negative text-center py-4">Não foi possível carregar os backups.</p>}
          {backups && backups.length === 0 && (
            <p className="text-sm text-muted text-center py-4">Nenhum backup enviado ainda.</p>
          )}
          {backups?.map((backup) => (
            <div
              key={backup.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-surface border border-border"
            >
              <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className="text-sm font-semibold truncate">{backup.name}</span>
                <span className="text-xs text-muted">
                  {new Date(backup.createdTime).toLocaleString('pt-BR')} · {formatBackupSize(backup.size)}
                </span>
              </div>
              <button
                onClick={() => onSelect(backup)}
                className="h-8 px-3 rounded-lg text-xs font-semibold bg-brand"
              >
                Restaurar
              </button>
              <button
                onClick={() => onDelete(backup)}
                aria-label={`Remover ${backup.name}`}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-negative bg-card shrink-0"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
