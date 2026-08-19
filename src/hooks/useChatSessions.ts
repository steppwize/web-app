import { useQuery } from '@tanstack/react-query'
import { listChatSessions } from '../api/chatHistory'

export function useChatSessions() {
  return useQuery({
    queryKey: ['chat-sessions'],
    queryFn: () => listChatSessions(),
  })
}
