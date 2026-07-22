import { db } from './client'
import { accountTag, accounts, CARD_CATEGORY_ID, categories, tags, TRANSFER_CATEGORY_ID } from './schema'

// Ported verbatim from core-api's CategoryService.GetDefaultCategories.
const DEFAULT_CATEGORIES = [
  { name: 'Alimentação', color: '#00ffff', icon: 'mdi-silverware-variant' },
  { name: 'Assinaturas e serviços', color: '#cc66ff', icon: 'mdi-newspaper' },
  { name: 'Bares e restaurantes', color: '#999966', icon: 'mdi-glass-tulip' },
  { name: 'Casa', color: '#8080ff', icon: 'mdi-home' },
  { name: 'Compras', color: '#ffb3ff', icon: 'mdi-basket' },
  { name: 'Cuidados Pessoais', color: '#ff4d4d', icon: 'mdi-account' },
  { name: 'Dívidas e empréstimos', color: '#ff4d4d', icon: 'mdi-receipt' },
  { name: 'Educação', color: '#9933ff', icon: 'mdi-school' },
  { name: 'Família e filhos', color: '#99ff99', icon: 'mdi-heart' },
  { name: 'Impostos e taxas', color: '#ff4d4d', icon: 'mdi-file' },
  { name: 'Investimentos', color: '#008000', icon: 'mdi-chart-line' },
  { name: 'Lazer e hobbies', color: '#990099', icon: 'mdi-star' },
  { name: 'Mercado', color: '#ff4d4d', icon: 'mdi-cart' },
  { name: 'Outros', color: '#000000', icon: 'mdi-dots-horizontal' },
  { name: 'Pets', color: '#ffcc00', icon: 'mdi-pig' },
  { name: 'Presentes e doações', color: '#cc0066', icon: 'mdi-gift' },
  { name: 'Roupas', color: '#ff6600', icon: 'mdi-tshirt-crew' },
  { name: 'Saúde', color: '#3399ff', icon: 'mdi-hospital' },
  { name: 'Trabalho', color: '#0059b3', icon: 'mdi-tie' },
  { name: 'Transporte', color: '#3399ff', icon: 'mdi-subway' },
  { name: 'Viagem', color: '#ff4d4d', icon: 'mdi-airplane' },
  { name: 'Emprestimos', color: '#99ff99', icon: 'mdi-currency-usd' },
  { name: 'Outras receitas', color: '#00cc00', icon: 'mdi-dots-horizontal' },
  { name: 'Salário', color: '#009933', icon: 'mdi-cash' },
] as const

// Ported verbatim from core-api's TagService.GetDefaultTags.
const DEFAULT_TAGS = [
  { title: 'Custo Fixo', description: 'Custo Fixo', color: '#00ffff' },
  { title: 'Custo Variável', description: 'Custo Variável', color: '#cc66ff' },
  { title: 'Receita Fixa', description: 'Receita Fixa', color: '#999966' },
  { title: 'Receita Variável', description: 'Receita Variável', color: '#8080ff' },
  { title: 'Pessoal', description: 'Pessoal', color: '#ffb3ff' },
  { title: 'Empresa', description: 'Empresa', color: '#ff4d4d' },
] as const

export async function seedIfEmpty(): Promise<void> {
  const existing = await db.select({ id: categories.id }).from(categories).limit(1)
  if (existing.length > 0) return

  await db.insert(categories).values(
    DEFAULT_CATEGORIES.map((c) => ({ id: crypto.randomUUID(), ...c })),
  )

  // Fixed ids: core-api's TransactionService.GetType classifies by these two literal category ids
  // (card / transfer). "Transferências" is also looked up by name in the forecast engine, so the
  // name must match exactly.
  await db.insert(categories).values([
    { id: TRANSFER_CATEGORY_ID, name: 'Transferências', color: '#3399ff', icon: 'mdi-bank-transfer' },
    { id: CARD_CATEGORY_ID, name: 'Cartão', color: '#666666', icon: 'mdi-credit-card' },
  ])

  const insertedTags = await db
    .insert(tags)
    .values(DEFAULT_TAGS.map((t) => ({ id: crypto.randomUUID(), ...t })))
    .returning()

  const pessoalTag = insertedTags.find((t) => t.title === 'Pessoal')!
  const empresaTag = insertedTags.find((t) => t.title === 'Empresa')!

  const [personalAccount, businessAccount] = await db
    .insert(accounts)
    .values([
      {
        id: crypto.randomUUID(),
        name: 'Conta Pessoal',
        description: 'Conta para seu orçamento pessoal.',
        typeAccount: 0,
        initialValue: 0,
        isDefault: true,
      },
      {
        id: crypto.randomUUID(),
        name: 'Conta da Empresa',
        description: 'Conta para o orçamento do seu negócio.',
        typeAccount: 0,
        initialValue: 0,
        isDefault: false,
      },
    ])
    .returning()

  await db.insert(accountTag).values([
    { accountId: personalAccount.id, tagId: pessoalTag.id },
    { accountId: businessAccount.id, tagId: empresaTag.id },
  ])
}
