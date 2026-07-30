import {
  getHomeCashFlow as getHomeCashFlowService,
  getAccounts as getAccountsService,
  createAccount as createAccountService,
  updateAccount as updateAccountService,
  deleteAccount as deleteAccountService,
  type AccountInput,
} from '../services/accountService'
import { importOfxStatement as importOfxStatementService } from '../services/importOfx'

export function getHomeCashFlow(accountIds?: string[]) {
  return getHomeCashFlowService(accountIds)
}

export function getAccounts() {
  return getAccountsService()
}

export function createAccount(input: AccountInput) {
  return createAccountService(input)
}

export function updateAccount(id: string, input: AccountInput) {
  return updateAccountService(id, input)
}

export function deleteAccount(id: string) {
  return deleteAccountService(id)
}

export function importOfxStatement(accountId: string, file: string) {
  return importOfxStatementService(accountId, file)
}

export type { AccountInput }
