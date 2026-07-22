import { useToastStore } from '../../store/toastStore'

export function ToastHost() {
  const message = useToastStore((s) => s.message)
  if (!message) return null
  return (
    <div className="fixed bottom-28 lg:bottom-6 left-1/2 -translate-x-1/2 bg-card border border-border text-sm text-white px-4 py-2 rounded-full shadow-lg z-50">
      {message}
    </div>
  )
}
