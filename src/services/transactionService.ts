import { and, eq, inArray, isNull, lt } from 'drizzle-orm'
import { db } from '../db/client'
import { accountTag, accounts, categories, transactionTags, transactions, tags } from '../db/schema'
import { CARD_CATEGORY_ID, TRANSFER_CATEGORY_ID } from '../db/schema'
import { TypeAccount } from '../api/types'
import type { TransactionContract, TransactionResponse, TransactionTotalByAccount } from '../api/types'
import { makeDate, parseNaiveTimestamp, toNaiveTimestamp } from './dates'

function classifyType(value: number, categoryId: string | null): 0 | 1 | 2 | 3 {
  if (categoryId === TRANSFER_CATEGORY_ID) return 2
  if (categoryId === CARD_CATEGORY_ID) return 3
  return value > 0 ? 0 : 1
}

const selectColumns = {
  id: transactions.id,
  description: transactions.description,
  value: transactions.value,
  dueDate: transactions.dueDate,
  paidOut: transactions.paidOut,
  accountId: transactions.accountId,
  categoryId: transactions.categoryId,
  categoryName: categories.name,
  categoryColor: categories.color,
  categoryIcon: categories.icon,
}

function buildContract(
  row: {
    id: string
    description: string | null
    value: number
    dueDate: string
    paidOut: boolean
    accountId: string
    categoryId: string | null
    categoryName: string | null
    categoryColor: string | null
    categoryIcon: string | null
  },
  accountName: string,
  transactionTags: { id: string; title: string; color: string }[],
  accountTags: { id: string; title: string; color: string }[],
): TransactionContract {
  const dueDate = parseNaiveTimestamp(row.dueDate)
  return {
    id: row.id,
    type: classifyType(row.value, row.categoryId),
    description: row.description ?? '',
    value: row.value,
    account: accountName,
    accountId: row.accountId,
    accountTo: '',
    paidOut: row.paidOut,
    typeTransaction: 0,
    dueDate: toNaiveTimestamp(makeDate(dueDate.getFullYear(), dueDate.getMonth() + 1, dueDate.getDate())),
    categoryId: row.categoryId ?? '',
    categoryName: row.categoryName ?? '',
    icon: row.categoryIcon ?? '',
    color: row.categoryColor ?? '',
    subCardId: null,
    subCardLast4: null,
    subCardHolderName: null,
    transactionTags,
    accountTags,
    recurrencyType: null,
    frequencyType: 5,
    previewSource: null,
  }
}

async function loadTransactionContract(id: string): Promise<TransactionContract> {
  const [row] = await db
    .select(selectColumns)
    .from(transactions)
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .where(eq(transactions.id, id))
    .limit(1)
  if (!row) throw new Error('Transação não encontrada.')

  const [account] = await db.select().from(accounts).where(eq(accounts.id, row.accountId)).limit(1)
  const tagsByTx = await getTransactionTagsByTransactionIds([row.id])
  const accountTagsByAccount = await getAccountTagsByAccountIds([row.accountId])

  return buildContract(row, account?.name ?? '', tagsByTx.get(row.id) ?? [], accountTagsByAccount.get(row.accountId) ?? [])
}

export interface TransactionInput {
  description: string
  value: number
  accountId: string
  categoryId: string | null
  // 'YYYY-MM-DD' — always applied at midnight, matching how the rest of the app treats a
  // transaction's dueDate as a calendar day rather than a specific time.
  dueDate: string
  paidOut: boolean
}

export async function createTransaction(input: TransactionInput): Promise<TransactionContract> {
  const id = crypto.randomUUID()
  await db.insert(transactions).values({
    id,
    description: input.description,
    value: input.value,
    dueDate: `${input.dueDate}T00:00:00`,
    paidOut: input.paidOut,
    accountId: input.accountId,
    categoryId: input.categoryId,
  })
  return loadTransactionContract(id)
}

export async function updateTransaction(id: string, input: TransactionInput): Promise<TransactionContract> {
  const [row] = await db
    .update(transactions)
    .set({
      description: input.description,
      value: input.value,
      dueDate: `${input.dueDate}T00:00:00`,
      paidOut: input.paidOut,
      accountId: input.accountId,
      categoryId: input.categoryId,
      updatedAt: toNaiveTimestamp(new Date()),
    })
    .where(eq(transactions.id, id))
    .returning()
  if (!row) throw new Error('Transação não encontrada.')
  return loadTransactionContract(id)
}

// Lightweight sibling of updateTransaction for the row icon's quick-edit affordance — writes only
// categoryId instead of requiring the full form payload.
export async function updateTransactionCategory(id: string, categoryId: string | null): Promise<TransactionContract> {
  const [row] = await db
    .update(transactions)
    .set({ categoryId, updatedAt: toNaiveTimestamp(new Date()) })
    .where(eq(transactions.id, id))
    .returning()
  if (!row) throw new Error('Transação não encontrada.')
  return loadTransactionContract(id)
}

export async function deleteTransaction(id: string): Promise<{ message: string }> {
  await db
    .update(transactions)
    .set({ deleted: true, updatedAt: toNaiveTimestamp(new Date()) })
    .where(eq(transactions.id, id))
  return { message: 'Transação removida.' }
}

// Fixed/recurring transactions (core-api's FixedTransaction LoopUntil expansion) are out of MVP
// scope — this only covers concrete Transaction rows, matching what the Itaú import and current
// screens actually produce.
export async function getTransactions(month: number, year: number): Promise<TransactionResponse> {
  const date = makeDate(year, month, 1)

  const accountRows = await db.select().from(accounts).where(eq(accounts.deleted, false))
  const accountById = new Map(accountRows.map((a) => [a.id, a]))

  const accountTypeAccountIds = accountRows.filter((a) => a.typeAccount === TypeAccount.Account).map((a) => a.id)

  const pastTx =
    accountTypeAccountIds.length > 0
      ? await db
          .select({ value: transactions.value, dueDate: transactions.dueDate, paidOut: transactions.paidOut, accountId: transactions.accountId })
          .from(transactions)
          .where(
            and(
              eq(transactions.deleted, false),
              inArray(transactions.accountId, accountTypeAccountIds),
              lt(transactions.dueDate, toNaiveTimestamp(date)),
            ),
          )
      : []

  const previousMonthSummary: TransactionTotalByAccount[] = accountRows
    .filter((a) => a.typeAccount === TypeAccount.Account)
    .map((account) => {
      const accountPast = pastTx.filter((t) => t.accountId === account.id)
      return {
        accountId: account.id,
        totalExpectedPreviousMonth: accountPast.reduce((sum, t) => sum + t.value, 0) + account.initialValue,
        totalPreviousMonth:
          accountPast.filter((t) => t.paidOut).reduce((sum, t) => sum + t.value, 0) + account.initialValue,
      }
    })

  const currentRows =
    accountTypeAccountIds.length > 0
      ? await db
          .select(selectColumns)
          .from(transactions)
          .leftJoin(categories, eq(categories.id, transactions.categoryId))
          .where(
            and(
              eq(transactions.deleted, false),
              inArray(transactions.accountId, accountTypeAccountIds),
              isNull(transactions.transactionFrom),
              isNull(transactions.invoiceId),
            ),
          )
      : []

  const currentMonthRows = currentRows.filter((t) => {
    const d = parseNaiveTimestamp(t.dueDate)
    return d.getFullYear() === year && d.getMonth() + 1 === month
  })

  const txIds = currentMonthRows.map((t) => t.id)
  const tagsByTx = await getTransactionTagsByTransactionIds(txIds)
  const accountTagsByAccount = await getAccountTagsByAccountIds([...new Set(currentMonthRows.map((t) => t.accountId))])

  const txContracts: TransactionContract[] = currentMonthRows
    .map((t) =>
      buildContract(
        t,
        accountById.get(t.accountId)?.name ?? '',
        tagsByTx.get(t.id) ?? [],
        accountTagsByAccount.get(t.accountId) ?? [],
      ),
    )
    .sort((a, b) => parseNaiveTimestamp(a.dueDate).getTime() - parseNaiveTimestamp(b.dueDate).getTime())

  return { previousMonthSummary, transactions: txContracts }
}

async function getTransactionTagsByTransactionIds(
  transactionIds: string[],
): Promise<Map<string, { id: string; title: string; color: string }[]>> {
  if (transactionIds.length === 0) return new Map()
  const rows = await db
    .select({ transactionId: transactionTags.transactionId, id: tags.id, title: tags.title, color: tags.color })
    .from(transactionTags)
    .innerJoin(tags, eq(tags.id, transactionTags.tagId))
    .where(inArray(transactionTags.transactionId, transactionIds))

  const map = new Map<string, { id: string; title: string; color: string }[]>()
  for (const row of rows) {
    const list = map.get(row.transactionId) ?? []
    list.push({ id: row.id, title: row.title ?? '', color: row.color ?? '' })
    map.set(row.transactionId, list)
  }
  return map
}

async function getAccountTagsByAccountIds(
  accountIds: string[],
): Promise<Map<string, { id: string; title: string; color: string }[]>> {
  if (accountIds.length === 0) return new Map()
  const rows = await db
    .select({ accountId: accountTag.accountId, id: tags.id, title: tags.title, color: tags.color })
    .from(accountTag)
    .innerJoin(tags, eq(tags.id, accountTag.tagId))
    .where(inArray(accountTag.accountId, accountIds))

  const map = new Map<string, { id: string; title: string; color: string }[]>()
  for (const row of rows) {
    const list = map.get(row.accountId) ?? []
    list.push({ id: row.id, title: row.title ?? '', color: row.color ?? '' })
    map.set(row.accountId, list)
  }
  return map
}
