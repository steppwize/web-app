import {
  getHomeCashFlow as getHomeCashFlowService,
  getAccounts as getAccountsService,
  createAccount as createAccountService,
  updateAccount as updateAccountService,
  deleteAccount as deleteAccountService,
  type AccountInput,
} from '../services/accountService'

export function getHomeCashFlow() {
  return getHomeCashFlowService()
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

export type { AccountInput }
