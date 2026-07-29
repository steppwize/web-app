import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createFixedTransaction,
  deleteFixedTransaction,
  getFixedTransactions,
  updateFixedTransaction,
  type FixedTransactionInput,
} from '../api/fixedTransactions'

export function useFixedTransactions() {
  return useQuery({
    queryKey: ['fixed-transactions'],
    queryFn: getFixedTransactions,
  })
}

function useInvalidateFixedTransactions() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['fixed-transactions'] })
    queryClient.invalidateQueries({ queryKey: ['account-preview'] })
  }
}

export function useCreateFixedTransaction() {
  const invalidate = useInvalidateFixedTransactions()
  return useMutation({
    mutationFn: (input: FixedTransactionInput) => createFixedTransaction(input),
    onSuccess: invalidate,
  })
}

export function useUpdateFixedTransaction() {
  const invalidate = useInvalidateFixedTransactions()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: FixedTransactionInput }) => updateFixedTransaction(id, input),
    onSuccess: invalidate,
  })
}

export function useDeleteFixedTransaction() {
  const invalidate = useInvalidateFixedTransactions()
  return useMutation({
    mutationFn: (id: string) => deleteFixedTransaction(id),
    onSuccess: invalidate,
  })
}
