import type { PGlite } from '@electric-sql/pglite'
import { PGliteWorker } from '@electric-sql/pglite/worker'
import { drizzle } from 'drizzle-orm/pglite'
import PgliteWorkerThread from './pglite.worker?worker'
import * as schema from './schema'

// PGliteWorker proxies every call to the real PGlite instance inside the worker and satisfies the
// same runtime interface, but its TS type isn't structurally compatible with PGlite (private
// fields) — drizzle's pglite driver and pg_dump both type their `client`/`pg` param as PGlite, so
// the cast is required at both call sites.
export const pg = new PGliteWorker(
  new PgliteWorkerThread({
    name: 'steppwize-pglite',
  }),
) as unknown as PGlite

export const db = drizzle({ client: pg, schema })
