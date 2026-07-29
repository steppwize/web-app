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

// Groups a flat transaction list into chronological per-day buckets with a running balance —
// shared by computeMonthSummary (real months) and TransactionsPage's preview rendering (estimated
// future months), so both read as the same day-by-day "Saldo fim do dia" list. `reverse` defaults
// to true (most recent day first, right for looking back at a real month) but preview callers pass
// false so a forecast reads forward from day 1.
export function computeDayGroups(
  transactions: TransactionContract[],
  startingBalance: number,
  options?: { reverse?: boolean },
): DayGroup[] {
  const sorted = [...transactions].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())

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
  const dayGroups: DayGroup[] = []
  for (const dateKey of orderedKeys) {
    const dayTransactions = byDay.get(dateKey)!
    // tx.value is already signed (positive = credit, negative = debit), matching how core-api
    // itself derives PreviousMonthSummary (a plain sum of raw Values) — so the running balance
    // here just sums the signed value directly, no re-signing by type.
    const dayTotal = dayTransactions.reduce((sum, tx) => sum + tx.value, 0)
    running += dayTotal
    dayGroups.push({ dateKey, transactions: dayTransactions, dayTotal, endOfDayBalance: running })
  }

  return options?.reverse === false ? dayGroups : dayGroups.reverse()
}

export function computeMonthSummary(data: TransactionResponse): MonthSummary {
  const startingBalance = data.previousMonthSummary.reduce((sum, a) => sum + a.totalPreviousMonth, 0)

  let totalRevenue = 0
  let totalExpenses = 0
  for (const tx of data.transactions) {
    if (tx.type === TypeTransaction.Revenue) totalRevenue += tx.value
    else if (tx.type === TypeTransaction.Expenses || tx.type === TypeTransaction.Card) totalExpenses += -tx.value
  }

  const dayGroups = computeDayGroups(data.transactions, startingBalance)
  const projectedEndBalance = dayGroups.length > 0 ? dayGroups[0].endOfDayBalance : startingBalance

  return { startingBalance, totalRevenue, totalExpenses, projectedEndBalance, dayGroups }
}
