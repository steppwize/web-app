import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createTag, deleteTag, getTags, updateTag, type TagInput } from '../api/tags'

export function useTags() {
  return useQuery({
    queryKey: ['tags'],
    queryFn: getTags,
  })
}

function useInvalidateTags() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ['tags'] })
}

export function useCreateTag() {
  const invalidate = useInvalidateTags()
  return useMutation({
    mutationFn: (input: TagInput) => createTag(input),
    onSuccess: invalidate,
  })
}

export function useUpdateTag() {
  const invalidate = useInvalidateTags()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: TagInput }) => updateTag(id, input),
    onSuccess: invalidate,
  })
}

export function useDeleteTag() {
  const invalidate = useInvalidateTags()
  return useMutation({
    mutationFn: (id: string) => deleteTag(id),
    onSuccess: invalidate,
  })
}
