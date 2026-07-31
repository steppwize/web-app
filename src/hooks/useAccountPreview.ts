import { useQuery } from '@tanstack/react-query'
import { getAccountPreview, getAccountPreviewCarry } from '../api/transactions'

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

// Cumulative negative/positive carry from any in-between preview-only months (see
// getAccountPreviewCarry) — added to the target month's server-computed starting balance so a
// preview month that projects negative actually drags the following month's opening balance down.
export function useAccountPreviewCarry(
  year: number,
  month: number,
  options?: { enabled?: boolean; accountIds?: string[] },
) {
  return useQuery({
    queryKey: ['account-preview-carry', year, month, options?.accountIds] as const,
    queryFn: () => getAccountPreviewCarry(year, month, options?.accountIds),
    enabled: options?.enabled ?? true,
  })
}
