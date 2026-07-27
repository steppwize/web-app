import { pg } from '../db/client'

function backupFilename(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  // Minute granularity: unlike the local download, Drive can hold many same-day backups.
  return `steppwize-backup-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.tar.gz`
}

export async function createBackupBlob(): Promise<{ blob: Blob; filename: string }> {
  const blob = await pg.dumpDataDir('gzip')
  return { blob, filename: backupFilename(new Date()) }
}

export async function exportBackup(): Promise<void> {
  const { blob, filename } = await createBackupBlob()

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
