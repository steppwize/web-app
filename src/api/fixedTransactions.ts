import {
  getFixedTransactions as getFixedTransactionsService,
  createFixedTransaction as createFixedTransactionService,
  updateFixedTransaction as updateFixedTransactionService,
  deleteFixedTransaction as deleteFixedTransactionService,
  type FixedTransactionInput,
} from '../services/fixedTransactionService'

export function getFixedTransactions() {
  return getFixedTransactionsService()
}

export function createFixedTransaction(input: FixedTransactionInput) {
  return createFixedTransactionService(input)
}

export function updateFixedTransaction(id: string, input: FixedTransactionInput) {
  return updateFixedTransactionService(id, input)
}

export function deleteFixedTransaction(id: string) {
  return deleteFixedTransactionService(id)
}

export type { FixedTransactionInput }
