import { useQuery } from '@tanstack/react-query'
import { getInvoicePreview } from '../api/cards'

export function previewInvoiceQueryKey(cardId: string, year: number, month: number) {
  return ['invoice-preview', cardId, year, month] as const
}

export function useInvoicePreview(
  cardId: string | undefined,
  year: number,
  month: number,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: previewInvoiceQueryKey(cardId ?? '', year, month),
    queryFn: () => getInvoicePreview(cardId as string, year, month),
    enabled: !!cardId && (options?.enabled ?? true),
  })
}
