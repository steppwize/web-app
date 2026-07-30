import {
  getTransactions as getTransactionsService,
  createTransaction as createTransactionService,
  updateTransaction as updateTransactionService,
  updateTransactionCategory as updateTransactionCategoryService,
  deleteTransaction as deleteTransactionService,
  type TransactionInput,
} from '../services/transactionService'
import { getAccountPreview as getAccountPreviewService } from '../services/accountService'

export function getTransactions(month: number, year: number) {
  return getTransactionsService(month, year)
}

export function getAccountPreview(year: number, month: number) {
  return getAccountPreviewService(year, month)
}

export function createTransaction(input: TransactionInput) {
  return createTransactionService(input)
}

export function updateTransaction(id: string, input: TransactionInput) {
  return updateTransactionService(id, input)
}

export function updateTransactionCategory(id: string, categoryId: string | null) {
  return updateTransactionCategoryService(id, categoryId)
}

export function deleteTransaction(id: string) {
  return deleteTransactionService(id)
}

export type { TransactionInput }
