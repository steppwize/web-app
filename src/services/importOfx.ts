import { and, eq, isNotNull } from 'drizzle-orm'
import { db } from '../db/client'
import { accounts, categories, transactions } from '../db/schema'
import { TypeAccount } from '../api/types'
import type { ImportOfxResponse } from '../api/types'
import { getActiveRules, match } from './ruleService'

// OFX 1.x is SGML, not XML: most leaf tags (e.g. <TRNAMT>-5.00) have no closing tag, so a leaf
// value runs to the next tag or newline. <STMTTRN> blocks themselves are properly closed, which
// is what makes them reliable to extract with a plain regex instead of a full SGML parser.
function extractBlocks(content: string, tag: string): string[] {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'gi')
  const blocks: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(content))) blocks.push(m[1])
  return blocks
}

function extractLeaf(block: string, tag: string): string | null {
  const m = new RegExp(`<${tag}>([^<\r\n]*)`, 'i').exec(block)
  return m ? m[1].trim() : null
}

// DTPOSTED looks like "20260504100000[-03:EST]". core-api dates are naive (timezone-less), so we
// take the wall-clock digits as-is and drop the bracketed offset rather than shifting to UTC.
function parseOfxDate(raw: string): string {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?/.exec(raw)
  if (!m) throw new Error(`Data inválida no OFX: ${raw}`)
  const [, y, mo, d, h = '00', mi = '00', s = '00'] = m
  return `${y}-${mo}-${d}T${h}:${mi}:${s}`
}

interface OfxTransaction {
  fitId: string
  description: string
  value: number
  dueDate: string
}

function parseOfxTransactions(content: string): OfxTransaction[] {
  return extractBlocks(content, 'STMTTRN').map((block) => {
    const fitId = extractLeaf(block, 'FITID') ?? crypto.randomUUID()
    const description = (extractLeaf(block, 'MEMO') ?? extractLeaf(block, 'NAME') ?? '').slice(0, 255)
    const value = Number(extractLeaf(block, 'TRNAMT') ?? '0')
    const dueDate = parseOfxDate(extractLeaf(block, 'DTPOSTED') ?? '')
    return { fitId, description, value, dueDate }
  })
}

export async function importOfxStatement(accountId: string, dataUrl: string): Promise<ImportOfxResponse> {
  const [account] = await db.select().from(accounts).where(and(eq(accounts.id, accountId), eq(accounts.deleted, false))).limit(1)
  if (!account) throw new Error('Conta não encontrada.')
  if (account.typeAccount !== TypeAccount.Account) throw new Error('AccountId deve ser uma conta corrente/poupança existente.')

  const base64 = dataUrl.split(',').slice(1).join(',')
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  const content = new TextDecoder('windows-1252').decode(bytes)

  const ofxTransactions = parseOfxTransactions(content)
  if (ofxTransactions.length === 0) throw new Error('Nenhum lançamento encontrado no arquivo OFX.')

  const existing = await db
    .select({ externalId: transactions.externalId })
    .from(transactions)
    .where(and(eq(transactions.accountId, accountId), eq(transactions.deleted, false), isNotNull(transactions.externalId)))
  const existingFitIds = new Set(existing.map((t) => t.externalId))

  const [categoryOther] = await db.select({ id: categories.id }).from(categories).where(eq(categories.name, 'Outros')).limit(1)
  if (!categoryOther) throw new Error('Categoria "Outros" não encontrada.')

  const rules = await getActiveRules()

  const response: ImportOfxResponse = { transactionsImported: 0, transactionsSkipped: 0, totalValue: 0 }

  for (const ofxTx of ofxTransactions) {
    if (existingFitIds.has(ofxTx.fitId)) {
      response.transactionsSkipped++
      continue
    }

    const matchedCategoryId = match(rules, ofxTx.description)

    await db.insert(transactions).values({
      id: crypto.randomUUID(),
      accountId,
      description: ofxTx.description,
      dueDate: ofxTx.dueDate,
      value: ofxTx.value,
      categoryId: matchedCategoryId ?? categoryOther.id,
      paidOut: true,
      externalId: ofxTx.fitId,
    })

    existingFitIds.add(ofxTx.fitId)
    response.transactionsImported++
    response.totalValue += ofxTx.value
  }

  return response
}
