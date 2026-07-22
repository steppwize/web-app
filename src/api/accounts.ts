import { getHomeCashFlow as getHomeCashFlowService } from '../services/accountService'

export function getHomeCashFlow() {
  return getHomeCashFlowService()
}
