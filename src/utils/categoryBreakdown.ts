import type { TransactionContract } from '../api/types'

const FALLBACK_COLOR = '#8B8FA8'
const MAX_SLICES = 6
const REST_KEY = '__rest__'

export interface CategorySlice {
  key: string
  label: string
  color: string
  value: number
  percentage: number
  categoryNames: string[]
}

export function buildCategoryBreakdown(transactions: TransactionContract[]): CategorySlice[] {
  const totals = new Map<string, { value: number; color: string }>()
  let total = 0

  for (const tx of transactions) {
    if (tx.value >= 0) continue
    const amount = Math.abs(tx.value)
    total += amount
    const key = tx.categoryName || 'Sem categoria'
    const existing = totals.get(key)
    if (existing) existing.value += amount
    else totals.set(key, { value: amount, color: tx.color || FALLBACK_COLOR })
  }

  if (total === 0) return []

  const sorted = [...totals.entries()]
    .map(([categoryName, { value, color }]) => ({ categoryName, color, value }))
    .sort((a, b) => b.value - a.value)

  const top = sorted.slice(0, MAX_SLICES)
  const rest = sorted.slice(MAX_SLICES)
  const slices: CategorySlice[] = top.map((s) => ({
    key: s.categoryName,
    label: s.categoryName,
    color: s.color,
    value: s.value,
    percentage: (s.value / total) * 100,
    categoryNames: [s.categoryName],
  }))

  if (rest.length > 0) {
    const restValue = rest.reduce((sum, s) => sum + s.value, 0)
    slices.push({
      key: REST_KEY,
      label: 'Outras categorias',
      color: FALLBACK_COLOR,
      value: restValue,
      percentage: (restValue / total) * 100,
      categoryNames: rest.map((s) => s.categoryName),
    })
  }

  return slices
}
