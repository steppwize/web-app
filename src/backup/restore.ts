import { pg } from '../db/client'
import { stagePendingRestore } from '../db/restoreStaging'

// See restoreStaging.ts for why this can't apply in-place: the file is staged, the current
// PGliteWorker connection is closed, and the page reloads — main.tsx applies the staged file into
// the idb store before the next PGliteWorker is constructed.
export async function restoreBackup(file: File): Promise<void> {
  await stagePendingRestore(file)
  await pg.close().catch(() => {})
  window.location.reload()
}
