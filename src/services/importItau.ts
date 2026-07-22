import * as XLSX from 'xlsx'
import { and, eq } from 'drizzle-orm'
import { db } from '../db/client'
import { accounts, categories, invoices, subCards, transactions } from '../db/schema'
import { TypeAccount } from '../api/types'
import type { ImportItauFaturaResponse } from '../api/types'
import { getActiveRules, match } from './ruleService'
import { makeDate, parseNaiveTimestamp, toNaiveTimestamp } from './dates'

function excelSerialToYmd(serial: number): { y: number; m: number; d: number } {
  const utcDays = Math.floor(serial - 25569)
  const date = new Date(utcDays * 86400 * 1000)
  return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate() }
}

function parseCellDate(cell: unknown): Date {
  if (cell instanceof Date) {
    return makeDate(cell.getUTCFullYear(), cell.getUTCMonth() + 1, cell.getUTCDate())
  }
  if (typeof cell === 'number') {
    const { y, m, d } = excelSerialToYmd(cell)
    return makeDate(y, m, d)
  }
  const s = String(cell).trim()
  const brMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(s)
  if (brMatch) {
    const year = brMatch[3].length === 2 ? Number(`20${brMatch[3]}`) : Number(brMatch[3])
    return makeDate(year, Number(brMatch[2]), Number(brMatch[1]))
  }
  return new Date(s)
}

function parseCellDecimal(cell: unknown): number {
  if (typeof cell === 'number') return cell
  const raw = String(cell ?? '').trim()
  const plain = Number(raw)
  if (!Number.isNaN(plain) && raw !== '') return plain
  const brNormalized = raw.replace(/\./g, '').replace(',', '.')
  return Number(brNormalized)
}

function cellText(cell: unknown): string {
  return cell === null || cell === undefined ? '' : String(cell).trim()
}

function isBlankCell(cell: unknown): boolean {
  return cell === null || cell === undefined || String(cell).trim() === ''
}

export async function importItauFatura(accountId: string, dataUrl: string): Promise<ImportItauFaturaResponse> {
  const [account] = await db.select().from(accounts).where(and(eq(accounts.id, accountId), eq(accounts.deleted, false))).limit(1)
  if (!account) throw new Error('Conta não encontrada.')
  if (account.typeAccount !== TypeAccount.Card) throw new Error('AccountId deve ser um cartão (Card) existente.')

  const base64 = dataUrl.split(',').slice(1).join(',')
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  const workbook = XLSX.read(bytes, { type: 'array', raw: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true })

  const response: ImportItauFaturaResponse = {
    transactionsImported: 0,
    transactionsDeleted: 0,
    totalValue: 0,
    invoiceMonth: 0,
    invoiceYear: 0,
    skippedPreviousPaymentValue: null,
    skippedPreviousPaymentDate: null,
  }

  let vencimento: Date | null = null
  for (let r = 0; r < rows.length - 1 && !vencimento; r++) {
    const row = rows[r] ?? []
    for (let c = 0; c < row.length; c++) {
      if (cellText(row[c]) === 'Vencimento') {
        vencimento = parseCellDate((rows[r + 1] ?? [])[c])
        break
      }
    }
  }
  if (!vencimento) throw new Error('Não foi possível localizar o vencimento no xlsx.')

  let headerRow = -1
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] ?? []
    if (row.length > 2 && cellText(row[1]) === 'Data' && cellText(row[2]) === 'Lançamento') {
      headerRow = r
      break
    }
  }
  if (headerRow === -1) throw new Error('Não foi possível localizar a tabela de lançamentos no xlsx.')

  response.invoiceMonth = vencimento.getMonth() + 1
  response.invoiceYear = vencimento.getFullYear()

  const existingInvoices = await db.select().from(invoices).where(eq(invoices.accountId, accountId))
  let invoice = existingInvoices.find((i) => {
    const d = parseNaiveTimestamp(i.date)
    return d.getFullYear() === vencimento!.getFullYear() && d.getMonth() + 1 === vencimento!.getMonth() + 1
  })

  if (!invoice) {
    const [created] = await db
      .insert(invoices)
      .values({ id: crypto.randomUUID(), accountId, date: toNaiveTimestamp(vencimento) })
      .returning()
    invoice = created
  } else {
    await db.update(invoices).set({ date: toNaiveTimestamp(vencimento) }).where(eq(invoices.id, invoice.id))
    const existingTx = await db.select({ id: transactions.id }).from(transactions).where(eq(transactions.invoiceId, invoice.id))
    if (existingTx.length > 0) {
      for (const tx of existingTx) {
        await db.delete(transactions).where(eq(transactions.id, tx.id))
      }
    }
    response.transactionsDeleted = existingTx.length
  }

  const [categoryOther] = await db.select({ id: categories.id }).from(categories).where(eq(categories.name, 'Outros')).limit(1)
  if (!categoryOther) throw new Error('Categoria "Outros" não encontrada.')

  const rules = await getActiveRules()

  const existingSubCards = await db.select().from(subCards).where(and(eq(subCards.accountId, accountId), eq(subCards.deleted, false)))
  const subCardByLast4 = new Map(existingSubCards.map((sc) => [sc.last4 ?? '', sc]))

  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r] ?? []
    const rawDateCell = row[1]
    if (isBlankCell(rawDateCell)) break // blank separator row before the "Subtotal" footer

    const lancamento = cellText(row[2])
    if (!lancamento) continue

    const valor = parseCellDecimal(row[4])
    const originalDate = parseCellDate(rawDateCell)

    if (lancamento.toLowerCase() === 'pagamento efetuado') {
      response.skippedPreviousPaymentValue = Math.abs(valor)
      response.skippedPreviousPaymentDate = toNaiveTimestamp(originalDate)
      continue
    }

    if (lancamento.toLowerCase() === 'credito parcelamento da' || lancamento.toLowerCase() === 'parc fat pg') {
      continue
    }

    const parcelamento = cellText(row[3])
    const nome = cellText(row[7])
    const tipoCartao = cellText(row[8])
    const last4 = cellText(row[9]).replace(/\*/g, '').trim()

    let subCardId: string | null = null
    if (last4) {
      let subCard = subCardByLast4.get(last4)
      if (!subCard) {
        const [created] = await db
          .insert(subCards)
          .values({ id: crypto.randomUUID(), accountId, last4, holderName: nome, cardType: tipoCartao })
          .returning()
        subCard = created
        subCardByLast4.set(last4, subCard)
      }
      subCardId = subCard.id
    }

    let description = lancamento
    if (parcelamento) description = `${description} [${parcelamento}]`
    description = description.slice(0, 255)

    const matchedCategoryId = match(rules, description)

    await db.insert(transactions).values({
      id: crypto.randomUUID(),
      accountId,
      invoiceId: invoice.id,
      subCardId,
      description,
      dueDate: toNaiveTimestamp(originalDate),
      value: -valor,
      categoryId: matchedCategoryId ?? categoryOther.id,
      paidOut: false,
    })

    response.transactionsImported++
    response.totalValue += -valor
  }

  return response
}
