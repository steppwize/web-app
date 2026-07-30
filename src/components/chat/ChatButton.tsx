import { MessageCircle } from 'lucide-react'
import { useChatStore } from '../../store/chatStore'

export function ChatButton() {
  const open = useChatStore((s) => s.open)

  return (
    <button
      onClick={open}
      aria-label="Abrir assistente"
      className="fixed z-30 right-5 bottom-24 lg:bottom-6 w-14 h-14 rounded-full bg-brand text-white shadow-lg flex items-center justify-center hover:bg-brand-light transition-colors"
    >
      <MessageCircle size={24} />
    </button>
  )
}
