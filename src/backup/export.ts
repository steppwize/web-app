import { pg } from '../db/client'

export async function exportBackup(): Promise<void> {
  const dump = await pg.dumpDataDir('gzip')

  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const filename = `steppwize-backup-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}.tar.gz`

  const url = URL.createObjectURL(dump)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
