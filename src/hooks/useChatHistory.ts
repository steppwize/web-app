import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UIMessage } from 'ai'
import { getChatHistory, saveChatHistory, clearChatHistory } from '../api/chatHistory'

export function useChatHistory() {
  return useQuery({
    queryKey: ['chat-history'],
    queryFn: () => getChatHistory(),
  })
}

export function useSaveChatHistory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (messages: UIMessage[]) => saveChatHistory(messages),
    // ChatModal never unmounts on close (it just renders null), so the ['chat-history'] query stays
    // mounted and won't refetch on its own when the modal reopens — write the just-saved messages
    // straight into the cache instead of waiting on an invalidation-triggered refetch.
    onSuccess: (_data, messages) => {
      queryClient.setQueryData(['chat-history'], messages)
    },
  })
}

export function useClearChatHistory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => clearChatHistory(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chat-history'] }),
  })
}
