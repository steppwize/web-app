import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UIMessage } from 'ai'
import { getChatHistory, saveChatHistory, deleteChatSession } from '../api/chatHistory'

export function useChatHistory(sessionId: string) {
  return useQuery({
    queryKey: ['chat-history', sessionId],
    queryFn: () => getChatHistory(sessionId),
  })
}

export function useSaveChatHistory(sessionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (messages: UIMessage[]) => saveChatHistory(sessionId, messages),
    // ChatModal never unmounts on close (it just renders null), so the ['chat-history', sessionId]
    // query stays mounted and won't refetch on its own when the modal reopens — write the
    // just-saved messages straight into the cache instead of waiting on an invalidation-triggered
    // refetch. The sessions list (title/order) does need a real invalidation since it derives from
    // the saved row, not from anything held in this component's state.
    onSuccess: (_data, messages) => {
      queryClient.setQueryData(['chat-history', sessionId], messages)
      queryClient.invalidateQueries({ queryKey: ['chat-sessions'] })
    },
  })
}

export function useDeleteChatSession(sessionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => deleteChatSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-history', sessionId] })
      queryClient.invalidateQueries({ queryKey: ['chat-sessions'] })
    },
  })
}
