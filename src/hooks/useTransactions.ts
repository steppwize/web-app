import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getTransactions,
  createTransaction,
  updateTransaction,
  updateTransactionCategory,
  deleteTransaction,
  type TransactionInput,
} from '../api/transactions'

export function useTransactions(month: number, year: number) {
  return useQuery({
    queryKey: ['transactions', month, year],
    queryFn: () => getTransactions(month, year),
  })
}

function useInvalidateTransactions() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['transactions'] })
    queryClient.invalidateQueries({ queryKey: ['account-preview'] })
    queryClient.invalidateQueries({ queryKey: ['home-cash-flow'] })
  }
}

export function useCreateTransaction() {
  const invalidate = useInvalidateTransactions()
  return useMutation({
    mutationFn: (input: TransactionInput) => createTransaction(input),
    onSuccess: invalidate,
  })
}

export function useUpdateTransaction() {
  const invalidate = useInvalidateTransactions()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: TransactionInput }) => updateTransaction(id, input),
    onSuccess: invalidate,
  })
}

export function useUpdateTransactionCategory() {
  const invalidate = useInvalidateTransactions()
  return useMutation({
    mutationFn: ({ id, categoryId }: { id: string; categoryId: string | null }) =>
      updateTransactionCategory(id, categoryId),
    onSuccess: invalidate,
  })
}

export function useDeleteTransaction() {
  const invalidate = useInvalidateTransactions()
  return useMutation({
    mutationFn: (id: string) => deleteTransaction(id),
    onSuccess: invalidate,
  })
}
