import { useQuery } from '@tanstack/react-query'
import { getCardsPreview } from '../api/cards'

export function cardsPreviewQueryKey(year: number, month: number) {
  return ['cards-preview', year, month] as const
}

export function useCardsPreview(year: number, month: number) {
  return useQuery({
    queryKey: cardsPreviewQueryKey(year, month),
    queryFn: () => getCardsPreview(year, month),
  })
}
