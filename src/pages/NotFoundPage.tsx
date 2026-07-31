import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-dvh gap-3 text-center px-6">
      <h1 className="text-2xl font-bold">404</h1>
      <p className="text-sm text-muted">Página não encontrada</p>
      <Link to="/" className="text-sm text-brand font-semibold">
        Voltar ao início
      </Link>
    </div>
  )
}
