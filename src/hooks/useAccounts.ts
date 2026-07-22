import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createAccount, deleteAccount, getAccounts, updateAccount, type AccountInput } from '../api/accounts'

export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
  })
}

function useInvalidateAccounts() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['accounts'] })
    queryClient.invalidateQueries({ queryKey: ['home-cash-flow'] })
  }
}

export function useCreateAccount() {
  const invalidate = useInvalidateAccounts()
  return useMutation({
    mutationFn: (input: AccountInput) => createAccount(input),
    onSuccess: invalidate,
  })
}

export function useUpdateAccount() {
  const invalidate = useInvalidateAccounts()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AccountInput }) => updateAccount(id, input),
    onSuccess: invalidate,
  })
}

export function useDeleteAccount() {
  const invalidate = useInvalidateAccounts()
  return useMutation({
    mutationFn: (id: string) => deleteAccount(id),
    onSuccess: invalidate,
  })
}
