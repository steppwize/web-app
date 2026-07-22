import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '../db/client'
import { accounts, categories, invoices, subCards, transactionTags, transactions, tags } from '../db/schema'
import { TypeAccount } from '../api/types'
import type { AccountResponse, CashFlowContract, TransactionContract, TransactionInvoiceResponse } from '../api/types'
import { addMonths, monthsBetween, parseNaiveTimestamp, makeDate, toNaiveTimestamp } from './dates'

function emptyAccountResponse(): AccountResponse {
  return {
    id: '',
    name: '',
    description: '',
    initialValue: 0,
    value: 0,
    typeAccount: TypeAccount.Account,
    limit: 0,
    closure: 0,
    dueDate: 0,
    institutionId: '',
    isDefault: false,
    accountTags: [],
    subCards: [],
  }
}

export async function getHomeCashFlow(): Promise<CashFlowContract> {
  const accountRows = await db.select().from(accounts).where(eq(accounts.deleted, false))

  const sums = await db
    .select({ accountId: transactions.accountId, total: sql<number>`coalesce(sum(${transactions.value}), 0)` })
    .from(transactions)
    .where(eq(transactions.paidOut, true))
    .groupBy(transactions.accountId)
  const sumByAccount = new Map(sums.map((s) => [s.accountId, Number(s.total)]))

  const accountResponses: AccountResponse[] = accountRows
    .filter((a) => a.typeAccount === TypeAccount.Account)
    .map((a) => ({
      ...emptyAccountResponse(),
      id: a.id,
      name: a.name ?? '',
      value: a.initialValue + (sumByAccount.get(a.id) ?? 0),
    }))

  const cardResponses: AccountResponse[] = accountRows
    .filter((a) => a.typeAccount === TypeAccount.Card)
    .map((a) => ({ ...emptyAccountResponse(), id: a.id, name: a.name ?? '', typeAccount: TypeAccount.Card }))

  return {
    total: accountResponses.reduce((sum, a) => sum + a.value, 0),
    accounts: accountResponses,
    cards: cardResponses,
    dashBoard: null,
  }
}

export async function getCards(): Promise<AccountResponse[]> {
  const cardRows = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.deleted, false), eq(accounts.typeAccount, TypeAccount.Card)))

  const cardIds = cardRows.map((c) => c.id)
  const subCardRows =
    cardIds.length > 0
      ? await db.select().from(subCards).where(and(inArray(subCards.accountId, cardIds), eq(subCards.deleted, false)))
      : []

  return cardRows.map((c) => ({
    ...emptyAccountResponse(),
    id: c.id,
    name: c.name ?? '',
    description: c.description ?? '',
    typeAccount: TypeAccount.Card,
    closure: c.closure,
    dueDate: c.dueDate,
    institutionId: c.institutionId ?? '',
    subCards: subCardRows
      .filter((sc) => sc.accountId === c.id)
      .map((sc) => ({
        id: sc.id,
        last4: sc.last4 ?? '',
        holderName: sc.holderName ?? '',
        cardType: sc.cardType ?? '',
      })),
  }))
}

interface JoinedTransaction {
  id: string
  description: string | null
  value: number
  dueDate: string
  paidOut: boolean
  categoryId: string | null
  categoryName: string | null
  categoryColor: string | null
  categoryIcon: string | null
  invoiceId: string | null
  subCardId: string | null
  subCardLast4: string | null
  subCardHolderName: string | null
}

async function getAccountTransactionsJoined(accountId: string): Promise<JoinedTransaction[]> {
  return db
    .select({
      id: transactions.id,
      description: transactions.description,
      value: transactions.value,
      dueDate: transactions.dueDate,
      paidOut: transactions.paidOut,
      categoryId: transactions.categoryId,
      categoryName: categories.name,
      categoryColor: categories.color,
      categoryIcon: categories.icon,
      invoiceId: transactions.invoiceId,
      subCardId: transactions.subCardId,
      subCardLast4: subCards.last4,
      subCardHolderName: subCards.holderName,
    })
    .from(transactions)
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .leftJoin(subCards, eq(subCards.id, transactions.subCardId))
    .where(and(eq(transactions.accountId, accountId), eq(transactions.deleted, false)))
}

async function getTransactionTagsByTransactionIds(
  transactionIds: string[],
): Promise<Map<string, { id: string; title: string; color: string }[]>> {
  if (transactionIds.length === 0) return new Map()
  const rows = await db
    .select({
      transactionId: transactionTags.transactionId,
      id: tags.id,
      title: tags.title,
      color: tags.color,
    })
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

export async function getInvoice(cardId: string, year: number, month: number): Promise<TransactionInvoiceResponse | null> {
  const [account] = await db.select().from(accounts).where(eq(accounts.id, cardId)).limit(1)
  if (!account) return null

  const invoiceRows = await db.select().from(invoices).where(eq(invoices.accountId, cardId))
  const invoice = invoiceRows.find((i) => {
    const d = parseNaiveTimestamp(i.date)
    return d.getFullYear() === year && d.getMonth() + 1 === month
  })
  if (!invoice) return null

  const allTx = await getAccountTransactionsJoined(cardId)
  const invoiceTx = allTx.filter((t) => t.invoiceId === invoice.id)
  const tagsByTx = await getTransactionTagsByTransactionIds(invoiceTx.map((t) => t.id))

  const txContracts: TransactionContract[] = invoiceTx.map((t) => ({
    id: t.id,
    type: t.value < 0 ? 1 : 0,
    description: t.description ?? '',
    value: t.value,
    account: account.name ?? '',
    accountId: cardId,
    accountTo: '',
    paidOut: t.paidOut,
    typeTransaction: 0,
    dueDate: t.dueDate,
    categoryId: t.categoryId ?? '',
    categoryName: t.categoryName ?? '',
    icon: t.categoryIcon ?? '',
    color: t.categoryColor ?? '',
    subCardId: t.subCardId,
    subCardLast4: t.subCardLast4,
    subCardHolderName: t.subCardHolderName,
    transactionTags: tagsByTx.get(t.id) ?? [],
    accountTags: [],
    recurrencyType: null,
    frequencyType: 5,
    previewSource: null,
  }))

  return {
    invoiceId: invoice.id,
    name: account.name ?? '',
    dueDate: invoice.date,
    value: invoiceTx.reduce((sum, t) => sum + t.value, 0),
    payment: invoice.paymentDate != null,
    valuePayment: invoice.value,
    transactions: txContracts,
  }
}

export async function payInvoice(invoiceId: string, status: boolean): Promise<{ message: string }> {
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1)
  if (!invoice) throw new Error('Fatura não encontrada.')

  const invoiceDate = parseNaiveTimestamp(invoice.date)
  const windowStart = addMonths(invoiceDate, -1)

  const accountTx = await db
    .select({ id: transactions.id, value: transactions.value, dueDate: transactions.dueDate })
    .from(transactions)
    .where(eq(transactions.accountId, invoice.accountId))

  const windowTx = accountTx.filter((t) => {
    const d = parseNaiveTimestamp(t.dueDate)
    return d <= invoiceDate && d > windowStart
  })

  if (status) {
    const total = windowTx.reduce((sum, t) => sum + t.value, 0)
    await db
      .update(invoices)
      .set({ paymentDate: toNaiveTimestamp(new Date()), value: total })
      .where(eq(invoices.id, invoiceId))
    if (windowTx.length > 0) {
      await db
        .update(transactions)
        .set({ invoiceId })
        .where(
          inArray(
            transactions.id,
            windowTx.map((t) => t.id),
          ),
        )
    }
  } else {
    await db.update(invoices).set({ paymentDate: null, value: 0 }).where(eq(invoices.id, invoiceId))
  }

  return { message: status ? 'Fatura paga.' : 'Pagamento da fatura desfeito.' }
}

const INSTALLMENT_REGEX = /^(?<base>.*?)\s*\[Parcela (?<n>\d+) de (?<total>\d+)\](?<suffix>.*)$/i

function normalizeDescription(description: string | null | undefined): string {
  let d = (description ?? '').trim()
  d = d.replace(/\s*\(compra orig\.\s*\d{2}\/\d{2}\/\d{4}\)\s*$/i, '')
  return d.trim().toLowerCase()
}

export async function getInvoicePreview(
  cardId: string,
  year: number,
  month: number,
): Promise<TransactionInvoiceResponse | null> {
  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, cardId), eq(accounts.deleted, false)))
    .limit(1)
  if (!account) return null

  const targetDate = makeDate(year, month, 1)

  const invoiceRows = await db.select().from(invoices).where(eq(invoices.accountId, cardId))
  const invoiceById = new Map(invoiceRows.map((i) => [i.id, i]))
  const currentInvoice = invoiceRows.find((i) => {
    const d = parseNaiveTimestamp(i.date)
    return d.getFullYear() === year && d.getMonth() + 1 === month
  })

  const [transferCategory] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.name, 'Transferências'))
    .limit(1)
  const transferCategoryId = transferCategory?.id ?? null

  const allTx = await getAccountTransactionsJoined(cardId)

  let lastRealInvoiceDate: Date | null = null
  for (const t of allTx) {
    if (!t.invoiceId) continue
    const invoice = invoiceById.get(t.invoiceId)
    if (!invoice) continue
    const invoiceDate = parseNaiveTimestamp(invoice.date)
    if (invoiceDate >= targetDate) continue
    if (!lastRealInvoiceDate || invoiceDate > lastRealInvoiceDate) lastRealInvoiceDate = invoiceDate
  }

  const windowEnd = lastRealInvoiceDate ? addMonths(lastRealInvoiceDate, 1) : targetDate
  const lookbackStart = addMonths(windowEnd, -3)

  const lookbackTransactions = allTx.filter((t) => {
    const d = parseNaiveTimestamp(t.dueDate)
    return d >= lookbackStart && d < windowEnd && t.categoryId !== transferCategoryId
  })

  const distinctMonths = new Set(
    lookbackTransactions.map((t) => {
      const d = parseNaiveTimestamp(t.dueDate)
      return `${d.getFullYear()}-${d.getMonth()}`
    }),
  )
  const monthsInWindow = Math.max(1, distinctMonths.size)

  const claimedIds = new Set<string>()
  const previewItems: TransactionContract[] = []

  const recentInstallmentTransactions = allTx.filter((t) => {
    if (!t.invoiceId) return false
    const invoice = invoiceById.get(t.invoiceId)
    if (!invoice) return false
    const invoiceDate = parseNaiveTimestamp(invoice.date)
    return invoiceDate >= lookbackStart && invoiceDate < windowEnd
  })

  const installmentMatches = recentInstallmentTransactions
    .map((t) => ({ transaction: t, match: INSTALLMENT_REGEX.exec(t.description ?? '') }))
    .filter((x): x is { transaction: JoinedTransaction; match: RegExpExecArray } => x.match !== null)

  const seriesMap = new Map<string, typeof installmentMatches>()
  for (const x of installmentMatches) {
    const key = `${normalizeDescription(x.match.groups!.base)}::${x.match.groups!.total}`
    const list = seriesMap.get(key) ?? []
    list.push(x)
    seriesMap.set(key, list)
  }

  for (const series of seriesMap.values()) {
    const latest = [...series].sort((a, b) => Number(b.match.groups!.n) - Number(a.match.groups!.n))[0]
    const n = Number(latest.match.groups!.n)
    const total = Number(latest.match.groups!.total)
    const invoice = invoiceById.get(latest.transaction.invoiceId!)!
    const lastInvoiceDate = parseNaiveTimestamp(invoice.date)
    const monthsAhead = monthsBetween(lastInvoiceDate, targetDate)
    const projectedN = n + monthsAhead
    if (projectedN > total) continue

    const t = latest.transaction
    previewItems.push({
      id: crypto.randomUUID(),
      type: t.value < 0 ? 1 : 0,
      description: `${latest.match.groups!.base.trim()} [Parcela ${projectedN} de ${total}]${latest.match.groups!.suffix}`,
      value: t.value,
      account: '',
      accountId: cardId,
      accountTo: '',
      paidOut: false,
      typeTransaction: 0,
      dueDate: toNaiveTimestamp(targetDate),
      categoryId: t.categoryId ?? '',
      categoryName: t.categoryName ?? '',
      icon: t.categoryIcon ?? '',
      color: t.categoryColor ?? '',
      subCardId: t.subCardId,
      subCardLast4: t.subCardLast4,
      subCardHolderName: t.subCardHolderName,
      transactionTags: [],
      accountTags: [],
      recurrencyType: null,
      frequencyType: 5,
      previewSource: 'Installment',
    })
  }

  for (const x of installmentMatches) claimedIds.add(x.transaction.id)

  if (monthsInWindow >= 3) {
    const groups = new Map<string, JoinedTransaction[]>()
    for (const t of lookbackTransactions) {
      if (claimedIds.has(t.id)) continue
      const key = normalizeDescription(t.description)
      const list = groups.get(key) ?? []
      list.push(t)
      groups.set(key, list)
    }

    for (const group of groups.values()) {
      const distinctGroupMonths = new Set(
        group.map((t) => {
          const d = parseNaiveTimestamp(t.dueDate)
          return `${d.getFullYear()}-${d.getMonth()}`
        }),
      )
      if (distinctGroupMonths.size < monthsInWindow) continue

      const mean = group.reduce((sum, t) => sum + t.value, 0) / group.length
      const tolerance = Math.abs(mean) * 0.15
      if (group.some((t) => Math.abs(t.value - mean) > tolerance)) continue

      const latest = [...group].sort(
        (a, b) => parseNaiveTimestamp(b.dueDate).getTime() - parseNaiveTimestamp(a.dueDate).getTime(),
      )[0]

      previewItems.push({
        id: crypto.randomUUID(),
        type: mean < 0 ? 1 : 0,
        description: latest.description ?? '',
        value: mean,
        account: '',
        accountId: cardId,
        accountTo: '',
        paidOut: false,
        typeTransaction: 0,
        dueDate: toNaiveTimestamp(targetDate),
        categoryId: latest.categoryId ?? '',
        categoryName: latest.categoryName ?? '',
        icon: latest.categoryIcon ?? '',
        color: latest.categoryColor ?? '',
        subCardId: latest.subCardId,
        subCardLast4: latest.subCardLast4,
        subCardHolderName: latest.subCardHolderName,
        transactionTags: [],
        accountTags: [],
        recurrencyType: null,
        frequencyType: 5,
        previewSource: 'Fixed',
      })

      for (const t of group) claimedIds.add(t.id)
    }
  }

  const categoryGroups = new Map<string, JoinedTransaction[]>()
  for (const t of lookbackTransactions) {
    if (claimedIds.has(t.id)) continue
    const key = t.categoryId ?? ''
    const list = categoryGroups.get(key) ?? []
    list.push(t)
    categoryGroups.set(key, list)
  }

  for (const group of categoryGroups.values()) {
    const average = group.reduce((sum, t) => sum + t.value, 0) / monthsInWindow
    if (average === 0) continue

    const sample = group[0]
    previewItems.push({
      id: crypto.randomUUID(),
      type: average < 0 ? 1 : 0,
      description: sample.categoryName ?? '',
      value: average,
      account: '',
      accountId: cardId,
      accountTo: '',
      paidOut: false,
      typeTransaction: 0,
      dueDate: toNaiveTimestamp(targetDate),
      categoryId: sample.categoryId ?? '',
      categoryName: sample.categoryName ?? '',
      icon: sample.categoryIcon ?? '',
      color: sample.categoryColor ?? '',
      subCardId: null,
      subCardLast4: null,
      subCardHolderName: null,
      transactionTags: [],
      accountTags: [],
      recurrencyType: null,
      frequencyType: 5,
      previewSource: 'CategoryAverage',
    })
  }

  previewItems.sort((a, b) => (a.categoryName ?? '').localeCompare(b.categoryName ?? ''))

  return {
    invoiceId: currentInvoice?.id ?? '',
    name: account.name ?? '',
    dueDate: currentInvoice?.date ?? toNaiveTimestamp(targetDate),
    payment: false,
    valuePayment: 0,
    value: previewItems.reduce((sum, i) => sum + i.value, 0),
    transactions: previewItems,
  }
}
