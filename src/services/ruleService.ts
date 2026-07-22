import { and, asc, eq } from 'drizzle-orm'
import { db } from '../db/client'
import { categories, rules, transactions } from '../db/schema'

export const RuleMatchType = {
  Contains: 0,
  Regex: 1,
} as const

export interface ActiveRule {
  id: string
  pattern: string
  matchType: number
  categoryId: string | null
}

export async function getActiveRules(): Promise<ActiveRule[]> {
  return db
    .select({ id: rules.id, pattern: rules.pattern, matchType: rules.matchType, categoryId: rules.categoryId })
    .from(rules)
    .where(and(eq(rules.deleted, false), eq(rules.active, true)))
    .orderBy(asc(rules.priority))
}

function isMatch(rule: ActiveRule, description: string): boolean {
  if (rule.matchType === RuleMatchType.Regex) {
    try {
      return new RegExp(rule.pattern, 'i').test(description)
    } catch {
      return false
    }
  }
  return description.toLowerCase().includes(rule.pattern.toLowerCase())
}

export function matchAgainst(activeRules: ActiveRule[], description: string | null | undefined): ActiveRule | null {
  if (!description) return null
  for (const rule of activeRules) {
    if (isMatch(rule, description)) return rule
  }
  return null
}

export function match(activeRules: ActiveRule[], description: string | null | undefined): string | null {
  return matchAgainst(activeRules, description)?.categoryId ?? null
}

export interface ApplyRulesResponse {
  transactionsEvaluated: number
  transactionsMatched: number
}

export async function apply(invoiceId?: string, onlyUncategorized = true): Promise<ApplyRulesResponse> {
  const activeRules = await getActiveRules()
  if (activeRules.length === 0) return { transactionsEvaluated: 0, transactionsMatched: 0 }

  const [categoryOther] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.deleted, false), eq(categories.name, 'Outros')))
    .limit(1)

  const conditions = [eq(transactions.deleted, false)]
  if (invoiceId) conditions.push(eq(transactions.invoiceId, invoiceId))
  if (onlyUncategorized && categoryOther) conditions.push(eq(transactions.categoryId, categoryOther.id))

  const candidates = await db
    .select({ id: transactions.id, description: transactions.description })
    .from(transactions)
    .where(and(...conditions))

  let transactionsMatched = 0
  for (const candidate of candidates) {
    const matchedRule = matchAgainst(activeRules, candidate.description)
    if (!matchedRule) continue
    await db.update(transactions).set({ categoryId: matchedRule.categoryId }).where(eq(transactions.id, candidate.id))
    transactionsMatched++
  }

  return { transactionsEvaluated: candidates.length, transactionsMatched }
}
