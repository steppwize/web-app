import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Landmark, LayoutGrid, Tag } from 'lucide-react'
import { AppShell } from './components/layout/AppShell'
import { ToastHost } from './components/ui/ToastHost'
import { HomePage } from './pages/HomePage'
import { TransactionsPage } from './pages/TransactionsPage'
import { CardsPage } from './pages/CardsPage'
import { CardInvoicePage } from './pages/CardInvoicePage'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { BackupPage } from './pages/BackupPage'
import { NotFoundPage } from './pages/NotFoundPage'

const queryClient = new QueryClient()

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
                <PlaceholderPage title="Contas" icon={Landmark} />
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
                <PlaceholderPage title="Categorias" icon={LayoutGrid} />
              </ShellRoute>
            }
          />
          <Route
            path="/tags"
            element={
              <ShellRoute>
                <PlaceholderPage title="Tags" icon={Tag} />
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
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
