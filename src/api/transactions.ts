import { getTransactions as getTransactionsService } from '../services/transactionService'
import { getAccountPreview as getAccountPreviewService } from '../services/accountService'

export function getTransactions(month: number, year: number) {
  return getTransactionsService(month, year)
}

export function getAccountPreview(year: number, month: number) {
  return getAccountPreviewService(year, month)
}
