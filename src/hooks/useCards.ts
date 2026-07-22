import { useQuery } from '@tanstack/react-query'
import { getCards } from '../api/cards'

export function useCards() {
  return useQuery({
    queryKey: ['cards'],
    queryFn: getCards,
  })
}
