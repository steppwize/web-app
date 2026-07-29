import { and, eq } from 'drizzle-orm'
import { db } from '../db/client'
import { accounts, categories, fixedTransactions } from '../db/schema'
import { FrequencyType, TypeAccount } from '../api/types'
import type { FixedTransactionResponse } from '../api/types'
import { toNaiveTimestamp } from './dates'

export interface FixedTransactionInput {
  description: string
  value: number
  accountId: string
  categoryId: string | null
  startDate: string
  endDate: string | null
}

const selectColumns = {
  id: fixedTransactions.id,
  description: fixedTransactions.description,
  value: fixedTransactions.value,
  accountId: fixedTransactions.accountId,
  accountName: accounts.name,
  categoryId: fixedTransactions.categoryId,
  categoryName: categories.name,
  categoryColor: categories.color,
  categoryIcon: categories.icon,
  startDate: fixedTransactions.startDate,
  endDate: fixedTransactions.endDate,
}

function toResponse(row: {
  id: string
  description: string | null
  value: number
  accountId: string
  accountName: string | null
  categoryId: string | null
  categoryName: string | null
  categoryColor: string | null
  categoryIcon: string | null
  startDate: string
  endDate: string | null
}): FixedTransactionResponse {
  return {
    id: row.id,
    description: row.description ?? '',
    value: row.value,
    accountId: row.accountId,
    accountName: row.accountName ?? '',
    categoryId: row.categoryId,
    categoryName: row.categoryName ?? '',
    categoryColor: row.categoryColor ?? '',
    categoryIcon: row.categoryIcon ?? '',
    startDate: row.startDate,
    endDate: row.endDate,
  }
}

// Only bank accounts get fixed transactions — cards have their own "Fixed" preview group,
// derived heuristically from statement history instead of a manual entry (see accountService.ts).
export async function getFixedTransactions(): Promise<FixedTransactionResponse[]> {
  const rows = await db
    .select(selectColumns)
    .from(fixedTransactions)
    .innerJoin(accounts, eq(accounts.id, fixedTransactions.accountId))
    .leftJoin(categories, eq(categories.id, fixedTransactions.categoryId))
    .where(and(eq(fixedTransactions.deleted, false), eq(accounts.typeAccount, TypeAccount.Account)))

  return rows.map(toResponse).sort((a, b) => a.description.localeCompare(b.description))
}

async function loadFixedTransactionResponse(id: string): Promise<FixedTransactionResponse> {
  const [row] = await db
    .select(selectColumns)
    .from(fixedTransactions)
    .innerJoin(accounts, eq(accounts.id, fixedTransactions.accountId))
    .leftJoin(categories, eq(categories.id, fixedTransactions.categoryId))
    .where(eq(fixedTransactions.id, id))
    .limit(1)
  if (!row) throw new Error('Fixo não encontrado.')
  return toResponse(row)
}

export async function createFixedTransaction(input: FixedTransactionInput): Promise<FixedTransactionResponse> {
  const [row] = await db
    .insert(fixedTransactions)
    .values({
      id: crypto.randomUUID(),
      description: input.description,
      value: input.value,
      accountId: input.accountId,
      categoryId: input.categoryId,
      startDate: input.startDate,
      endDate: input.endDate,
      frequencyType: FrequencyType.Monthly,
    })
    .returning()

  return loadFixedTransactionResponse(row.id)
}

export async function updateFixedTransaction(
  id: string,
  input: FixedTransactionInput,
): Promise<FixedTransactionResponse> {
  const [row] = await db
    .update(fixedTransactions)
    .set({
      description: input.description,
      value: input.value,
      accountId: input.accountId,
      categoryId: input.categoryId,
      startDate: input.startDate,
      endDate: input.endDate,
      updatedAt: toNaiveTimestamp(new Date()),
    })
    .where(eq(fixedTransactions.id, id))
    .returning()
  if (!row) throw new Error('Fixo não encontrado.')

  return loadFixedTransactionResponse(id)
}

export async function deleteFixedTransaction(id: string): Promise<{ message: string }> {
  await db
    .update(fixedTransactions)
    .set({ deleted: true, updatedAt: toNaiveTimestamp(new Date()) })
    .where(eq(fixedTransactions.id, id))
  return { message: 'Fixo removido.' }
}
