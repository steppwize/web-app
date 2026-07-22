import { useQuery } from '@tanstack/react-query'
import { getHomeCashFlow } from '../api/accounts'

export function useHomeCashFlow() {
  return useQuery({
    queryKey: ['home-cash-flow'],
    queryFn: getHomeCashFlow,
  })
}
