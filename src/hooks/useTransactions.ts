import { useQuery } from '@tanstack/react-query'
import { getTransactions } from '../api/transactions'

export function useTransactions(month: number, year: number) {
  return useQuery({
    queryKey: ['transactions', month, year],
    queryFn: () => getTransactions(month, year),
  })
}
