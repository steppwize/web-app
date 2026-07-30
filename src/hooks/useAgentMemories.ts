import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listMemories, saveMemory } from '../api/agentMemories'

export function useAgentMemories() {
  return useQuery({
    queryKey: ['agent-memories'],
    queryFn: () => listMemories(),
  })
}

export function useSaveMemory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (content: string) => saveMemory(content),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agent-memories'] }),
  })
}
