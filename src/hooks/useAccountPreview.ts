import { useQuery } from '@tanstack/react-query'
import { getAccountPreview } from '../api/transactions'

export function accountPreviewQueryKey(year: number, month: number) {
  return ['account-preview', year, month] as const
}

export function useAccountPreview(year: number, month: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: accountPreviewQueryKey(year, month),
    queryFn: () => getAccountPreview(year, month),
    enabled: options?.enabled ?? true,
  })
}
