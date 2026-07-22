import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

const root = createRoot(document.getElementById('root')!)

root.render(
  <div className="min-h-screen flex items-center justify-center bg-bg text-sm text-muted">Carregando...</div>,
)

async function bootstrap() {
  // Must run BEFORE `./db/client` is imported anywhere in the tree — that module constructs the
  // PGliteWorker singleton as soon as it's evaluated, and a restore has to land in the idb store
  // while no PGlite connection is open against it yet. See db/restoreStaging.ts.
  const { takePendingRestore } = await import('./db/restoreStaging')
  const pendingRestore = await takePendingRestore()
  if (pendingRestore) {
    const { PGlite } = await import('@electric-sql/pglite')
    await indexedDB.deleteDatabase('/pglite/steppwize')
    const restored = await PGlite.create({ dataDir: 'idb://steppwize', loadDataDir: pendingRestore })
    await restored.close()
  }

  const { ensureMigratedAndSeeded } = await import('./db/migrate')
  await ensureMigratedAndSeeded()

  const { default: App } = await import('./App.tsx')
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

bootstrap().catch((error: unknown) => {
  console.error('Failed to initialize local database', error)
  root.render(
    <div className="min-h-screen flex items-center justify-center bg-bg text-sm text-negative px-6 text-center">
      Não foi possível iniciar o banco de dados local. Tente recarregar a página.
    </div>,
  )
})
