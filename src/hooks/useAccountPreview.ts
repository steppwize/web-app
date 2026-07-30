import { useQuery } from '@tanstack/react-query'
import { getAccountPreview } from '../api/transactions'

export function accountPreviewQueryKey(year: number, month: number, accountIds?: string[]) {
  return ['account-preview', year, month, accountIds] as const
}

export function useAccountPreview(
  year: number,
  month: number,
  options?: { enabled?: boolean; accountIds?: string[] },
) {
  return useQuery({
    queryKey: accountPreviewQueryKey(year, month, options?.accountIds),
    queryFn: () => getAccountPreview(year, month, options?.accountIds),
    enabled: options?.enabled ?? true,
  })
}
