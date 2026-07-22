// Restoring a backup must load into the SAME idb store the live PGliteWorker already has open,
// which requires that worker's connection/lock to be gone first — the only clean way to guarantee
// that in a browser is a full page reload (which tears down its Worker thread and Web Lock).
// So a restore is staged here (a plain, non-PGlite IndexedDB store) and applied by main.tsx on the
// next boot, before the PGliteWorker singleton is constructed.
const DB_NAME = 'steppwize-restore-staging'
const STORE = 'pending'

function openStagingDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function stagePendingRestore(file: File): Promise<void> {
  const db = await openStagingDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(file, 'file')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function takePendingRestore(): Promise<File | null> {
  const db = await openStagingDb()
  const file = await new Promise<File | null>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const getReq = store.get('file')
    store.delete('file')
    getReq.onsuccess = () => resolve((getReq.result as File | undefined) ?? null)
    getReq.onerror = () => reject(getReq.error)
  })
  db.close()
  return file
}
