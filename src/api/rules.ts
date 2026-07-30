import { apply as applyService } from '../services/ruleService'

export function applyRules(invoiceId?: string, onlyUncategorized = true) {
  return applyService(invoiceId, onlyUncategorized)
}
