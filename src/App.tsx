import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppShell } from './components/layout/AppShell'
import { ToastHost } from './components/ui/ToastHost'
import { SyncRunner } from './components/sync/SyncRunner'
import { SyncConflictModal } from './components/sync/SyncConflictModal'
import { markDirty } from './backup/autoSync'
import { HomePage } from './pages/HomePage'
import { TransactionsPage } from './pages/TransactionsPage'
import { AccountsPage } from './pages/AccountsPage'
import { CardsPage } from './pages/CardsPage'
import { CardInvoicePage } from './pages/CardInvoicePage'
import { CategoriesPage } from './pages/CategoriesPage'
import { TagsPage } from './pages/TagsPage'
import { BackupPage } from './pages/BackupPage'
import { NotFoundPage } from './pages/NotFoundPage'

// A single MutationCache-level onSuccess covers every useMutation in the app (transactions,
// accounts, categories, tags, fixed transactions, OFX/Itaú imports, invoice payment) without
// touching each call site — per-mutation onSuccess handlers don't override this one.
const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onSuccess: () => markDirty(),
  }),
})

function ShellRoute({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <ShellRoute>
                <HomePage />
              </ShellRoute>
            }
          />
          <Route
            path="/transacoes"
            element={
              <ShellRoute>
                <TransactionsPage />
              </ShellRoute>
            }
          />
          <Route
            path="/contas"
            element={
              <ShellRoute>
                <AccountsPage />
              </ShellRoute>
            }
          />
          <Route
            path="/cartoes"
            element={
              <ShellRoute>
                <CardsPage />
              </ShellRoute>
            }
          />
          <Route
            path="/cartoes/:cardId"
            element={
              <ShellRoute>
                <CardInvoicePage />
              </ShellRoute>
            }
          />
          <Route
            path="/categorias"
            element={
              <ShellRoute>
                <CategoriesPage />
              </ShellRoute>
            }
          />
          <Route
            path="/tags"
            element={
              <ShellRoute>
                <TagsPage />
              </ShellRoute>
            }
          />
          <Route
            path="/backup"
            element={
              <ShellRoute>
                <BackupPage />
              </ShellRoute>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <ToastHost />
        <SyncRunner />
        <SyncConflictModal />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
