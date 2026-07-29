import type { TransactionContract } from '../api/types'

// Installments and fixed items are known/near-certain recurring charges; category averages are the
// vaguest estimate — so they're grouped in that order, each with its own subtotal, instead of one
// flat list sorted purely by value. Shared between the card invoice preview and the bank account
// preview (which never emits 'Installment', but the grouping/order logic is otherwise identical).
const PREVIEW_GROUP_ORDER: Record<string, number> = { Installment: 0, Fixed: 1, CategoryAverage: 2 }
const PREVIEW_GROUP_LABEL: Record<string, string> = { Installment: 'Parcelas', Fixed: 'Fixos', CategoryAverage: 'Média' }

export interface PreviewGroup {
  source: string
  label: string
  items: TransactionContract[]
  subtotal: number
}

export function groupPreviewTransactions(transactions: TransactionContract[]): PreviewGroup[] {
  const bySource = new Map<string, TransactionContract[]>()
  for (const tx of transactions) {
    const key = tx.previewSource ?? 'Outros'
    if (!bySource.has(key)) bySource.set(key, [])
    bySource.get(key)?.push(tx)
  }

  return [...bySource.entries()]
    .sort(([a], [b]) => (PREVIEW_GROUP_ORDER[a] ?? 99) - (PREVIEW_GROUP_ORDER[b] ?? 99))
    .map(([source, items]) => ({
      source,
      label: PREVIEW_GROUP_LABEL[source] ?? source,
      items: [...items].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)),
      subtotal: items.reduce((sum, tx) => sum + tx.value, 0),
    }))
}

export function previewSourceLabel(source: TransactionContract['previewSource']): string | null {
  if (source === 'Fixed') return 'Fixo'
  if (source === 'Installment') return 'Parcela'
  if (source === 'CategoryAverage') return 'Média'
  return null
}
