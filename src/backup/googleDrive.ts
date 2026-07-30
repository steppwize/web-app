import { clearCachedToken, getAccessToken } from './googleAuth'

const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'
const BACKUP_FOLDER_NAME = 'Steppwize Backups'
const AUTOSAVE_FILENAME = 'steppwize-autosave.tar.gz'
const KEEP_BACKUPS = 10

export interface DriveBackup {
  id: string
  name: string
  size: string
  createdTime: string
}

// appProperties on the autosave file — Drive stores these as flat string key/value pairs, so every
// field here is serialized/parsed as a string even though seq is logically a number.
export interface AutosaveProps {
  seq: string
  deviceId: string
  deviceName: string
  savedAt: string
}

export interface AutosaveMeta {
  id: string
  modifiedTime: string
  size: string
  appProperties: Partial<AutosaveProps>
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

// Shared resumable-upload primitive: start (POST or PATCH) then PUT the body to the returned
// Location. Used both by manual dated-backup uploads and by the autosave create/update paths.
async function resumableUpload(
  method: 'POST' | 'PATCH',
  startUrl: string,
  metadata: Record<string, unknown>,
  blob: Blob,
): Promise<{ id: string }> {
  const startRes = await driveFetch(startUrl, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Upload-Content-Type': 'application/gzip',
    },
    body: JSON.stringify(metadata),
  })
  const uploadUrl = startRes.headers.get('Location')
  if (!uploadUrl) {
    throw new Error('Não foi possível iniciar o envio para o Google Drive.')
  }

  // The PUT goes straight to the resumable session URL, which is already authenticated — it must
  // NOT go through driveFetch (that would attach a second, redundant Authorization header/token).
  const putRes = await fetch(uploadUrl, { method: 'PUT', body: blob })
  if (!putRes.ok) {
    throw new Error('Falha ao enviar o backup para o Google Drive.')
  }
  return (await putRes.json()) as { id: string }
}

export async function listBackups(): Promise<DriveBackup[]> {
  const folderId = await ensureBackupFolder()
  // Excludes the autosave file by name — it's a distinct, single-slot file managed by autoSync,
  // not one of the dated manual/prune-rotated backups this list is for.
  const query = `'${folderId}' in parents and trashed=false and name != '${AUTOSAVE_FILENAME}'`
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

  // Resumable (not multipart) upload: PGlite dumps can exceed the 5 MB multipart-upload limit.
  await resumableUpload(
    'POST',
    `${DRIVE_UPLOAD_API}/files?uploadType=resumable`,
    { name: filename, parents: [folderId] },
    blob,
  )

  await pruneOldBackups()
}

export async function downloadBackup(id: string): Promise<Blob> {
  const res = await driveFetch(`${DRIVE_API}/files/${id}?alt=media`)
  return res.blob()
}

// --- Autosave: a single fixed-name file overwritten in place, used by auto-sync. ---
// Kept separate from the dated manual backups above: same folder, but one stable fileId so
// versions can be compared via appProperties.seq instead of by filename/createdTime.

export async function findAutosaveFile(): Promise<string | null> {
  const folderId = await ensureBackupFolder()
  const query = `'${folderId}' in parents and trashed=false and name = '${AUTOSAVE_FILENAME}'`
  const res = await driveFetch(
    `${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id)&spaces=drive`,
  )
  const { files } = (await res.json()) as { files: { id: string }[] }
  return files[0]?.id ?? null
}

export async function getAutosaveMeta(fileId: string): Promise<AutosaveMeta> {
  const res = await driveFetch(`${DRIVE_API}/files/${fileId}?fields=id,size,modifiedTime,appProperties`)
  const meta = (await res.json()) as {
    id: string
    size?: string
    modifiedTime: string
    appProperties?: Partial<AutosaveProps>
  }
  return { id: meta.id, modifiedTime: meta.modifiedTime, size: meta.size ?? '0', appProperties: meta.appProperties ?? {} }
}

export async function createAutosave(blob: Blob, props: AutosaveProps): Promise<string> {
  const folderId = await ensureBackupFolder()
  const { id } = await resumableUpload(
    'POST',
    `${DRIVE_UPLOAD_API}/files?uploadType=resumable`,
    { name: AUTOSAVE_FILENAME, parents: [folderId], appProperties: props },
    blob,
  )
  return id
}

export async function updateAutosave(fileId: string, blob: Blob, props: AutosaveProps): Promise<void> {
  await resumableUpload(
    'PATCH',
    `${DRIVE_UPLOAD_API}/files/${fileId}?uploadType=resumable`,
    { appProperties: props },
    blob,
  )
}

// Snapshots the current autosave content as a dated file — used both for the once-a-day history
// copy and, defensively, to preserve the losing side's data before a conflict is resolved.
export async function copyAutosaveToDated(fileId: string, name: string): Promise<void> {
  const folderId = await ensureBackupFolder()
  await driveFetch(`${DRIVE_API}/files/${fileId}/copy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, parents: [folderId] }),
  })
  await pruneOldBackups()
}
