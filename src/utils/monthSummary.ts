import { TypeTransaction } from '../api/types'
import type { TransactionContract, TransactionResponse } from '../api/types'

export interface DayGroup {
  dateKey: string
  transactions: TransactionContract[]
  dayTotal: number
  endOfDayBalance: number
}

export interface MonthSummary {
  startingBalance: number
  totalRevenue: number
  totalExpenses: number
  projectedEndBalance: number
  dayGroups: DayGroup[]
}

export function computeMonthSummary(data: TransactionResponse): MonthSummary {
  const startingBalance = data.previousMonthSummary.reduce((sum, a) => sum + a.totalPreviousMonth, 0)

  const sorted = [...data.transactions].sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
  )

  const orderedKeys: string[] = []
  const byDay = new Map<string, TransactionContract[]>()
  for (const tx of sorted) {
    const key = tx.dueDate.slice(0, 10)
    if (!byDay.has(key)) {
      byDay.set(key, [])
      orderedKeys.push(key)
    }
    byDay.get(key)!.push(tx)
  }

  let running = startingBalance
  let totalRevenue = 0
  let totalExpenses = 0
  const dayGroups: DayGroup[] = []

  for (const dateKey of orderedKeys) {
    const transactions = byDay.get(dateKey)!
    let dayTotal = 0
    for (const tx of transactions) {
      // tx.value is already signed (positive = credit, negative = debit), matching how
      // core-api itself derives PreviousMonthSummary (a plain sum of raw Values) — so the
      // running balance here just sums the signed value directly, no re-signing by type.
      dayTotal += tx.value
      if (tx.type === TypeTransaction.Revenue) totalRevenue += tx.value
      else if (tx.type === TypeTransaction.Expenses || tx.type === TypeTransaction.Card) totalExpenses += -tx.value
    }
    running += dayTotal
    dayGroups.push({ dateKey, transactions, dayTotal, endOfDayBalance: running })
  }

  return {
    startingBalance,
    totalRevenue,
    totalExpenses,
    projectedEndBalance: running,
    dayGroups: dayGroups.reverse(),
  }
}
