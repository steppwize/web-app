import { useQuery } from '@tanstack/react-query'
import { getInvoice } from '../api/cards'

export function invoiceQueryKey(cardId: string, year: number, month: number) {
  return ['invoice', cardId, year, month] as const
}

export function useInvoice(cardId: string | undefined, year: number, month: number) {
  return useQuery({
    queryKey: invoiceQueryKey(cardId ?? '', year, month),
    queryFn: () => getInvoice(cardId as string, year, month),
    enabled: !!cardId,
  })
}
