import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getLlmSettings, saveLlmSettings, clearLlmSettings, type LlmSettings } from '../api/llmSettings'

export function useLlmSettings() {
  return useQuery({
    queryKey: ['llm-settings'],
    queryFn: () => getLlmSettings(),
  })
}

export function useSaveLlmSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: LlmSettings) => saveLlmSettings(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['llm-settings'] }),
  })
}

export function useClearLlmSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => clearLlmSettings(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['llm-settings'] }),
  })
}
