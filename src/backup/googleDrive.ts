import { clearCachedToken, getAccessToken } from './googleAuth'

const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'
const BACKUP_FOLDER_NAME = 'Steppwize Backups'
const KEEP_BACKUPS = 10

export interface DriveBackup {
  id: string
  name: string
  size: string
  createdTime: string
}

async function driveFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken()
  const response = await fetch(url, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` },
  })
  if (response.status === 401) {
    clearCachedToken()
    throw new Error('Sessão do Google expirada. Tente novamente.')
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null
    throw new Error(body?.error?.message ?? `Erro ao comunicar com o Google Drive (${response.status}).`)
  }
  return response
}

let cachedFolderId: string | null = null

// drive.file only lets the app see files/folders it created itself, so it's safe to search by name.
async function ensureBackupFolder(): Promise<string> {
  if (cachedFolderId) return cachedFolderId

  const query = `name='${BACKUP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  const listRes = await driveFetch(
    `${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id)&spaces=drive`,
  )
  const { files } = (await listRes.json()) as { files: { id: string }[] }
  if (files.length > 0) {
    cachedFolderId = files[0].id
    return cachedFolderId
  }

  const createRes = await driveFetch(`${DRIVE_API}/files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: BACKUP_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
  })
  const folder = (await createRes.json()) as { id: string }
  cachedFolderId = folder.id
  return cachedFolderId
}

export async function listBackups(): Promise<DriveBackup[]> {
  const folderId = await ensureBackupFolder()
  const query = `'${folderId}' in parents and trashed=false`
  const res = await driveFetch(
    `${DRIVE_API}/files?q=${encodeURIComponent(query)}&orderBy=createdTime desc&fields=files(id,name,size,createdTime)&spaces=drive`,
  )
  const { files } = (await res.json()) as { files: DriveBackup[] }
  return files
}

export async function deleteBackup(id: string): Promise<void> {
  await driveFetch(`${DRIVE_API}/files/${id}`, { method: 'DELETE' })
}

async function pruneOldBackups(): Promise<void> {
  try {
    const stale = (await listBackups()).slice(KEEP_BACKUPS)
    for (const backup of stale) {
      await deleteBackup(backup.id).catch(() => {})
    }
  } catch {
    // Pruning is best-effort — it must never turn a successful upload into a reported failure.
  }
}

export async function uploadBackup(blob: Blob, filename: string): Promise<void> {
  const folderId = await ensureBackupFolder()
  const token = await getAccessToken()

  // Resumable (not multipart) upload: PGlite dumps can exceed the 5 MB multipart-upload limit.
  const startRes = await fetch(`${DRIVE_UPLOAD_API}/files?uploadType=resumable`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Upload-Content-Type': 'application/gzip',
    },
    body: JSON.stringify({ name: filename, parents: [folderId] }),
  })
  if (!startRes.ok) {
    throw new Error('Não foi possível iniciar o envio para o Google Drive.')
  }
  const uploadUrl = startRes.headers.get('Location')
  if (!uploadUrl) {
    throw new Error('Não foi possível iniciar o envio para o Google Drive.')
  }

  const putRes = await fetch(uploadUrl, { method: 'PUT', body: blob })
  if (!putRes.ok) {
    throw new Error('Falha ao enviar o backup para o Google Drive.')
  }

  await pruneOldBackups()
}

export async function downloadBackup(id: string): Promise<Blob> {
  const res = await driveFetch(`${DRIVE_API}/files/${id}?alt=media`)
  return res.blob()
}
