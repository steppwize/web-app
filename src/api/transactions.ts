import { getTransactions as getTransactionsService } from '../services/transactionService'

export function getTransactions(month: number, year: number) {
  return getTransactionsService(month, year)
}
