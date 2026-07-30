import { useQuery } from '@tanstack/react-query'
import { getHomeCashFlow } from '../api/accounts'

export function useHomeCashFlow(accountIds?: string[]) {
  return useQuery({
    queryKey: ['home-cash-flow', accountIds],
    queryFn: () => getHomeCashFlow(accountIds),
  })
}
