import { boolean, integer, numeric, pgTable, primaryKey, text, timestamp, varchar } from 'drizzle-orm/pg-core'

// Two fixed category ids referenced by TransactionService's GetType classification in core-api.
// They must exist as real rows (seeded) for the same conventions to hold client-side.
export const CARD_CATEGORY_ID = '13c24bfc-3f9f-4e7f-a589-c1c56ccced32'
export const TRANSFER_CATEGORY_ID = '038c2456-2cb5-41ac-af1b-ab35dce1a81c'

const audit = {
  createdAt: timestamp('created_at', { mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).notNull().defaultNow(),
  deleted: boolean('deleted').notNull().default(false),
}

export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  name: text('name'),
  description: text('description'),
  typeAccount: integer('type_account').notNull().default(0),
  initialValue: numeric('initial_value', { mode: 'number' }).notNull().default(0),
  isDefault: boolean('is_default').notNull().default(false),
  limit: numeric('limit', { mode: 'number' }).notNull().default(0),
  closure: integer('closure').notNull().default(0),
  dueDate: integer('due_date').notNull().default(0),
  institutionId: text('institution_id'),
  ...audit,
})

export const categories = pgTable('categories', {
  id: text('id').primaryKey(),
  name: text('name'),
  color: text('color'),
  description: text('description'),
  parentCategory: text('parent_category'),
  icon: text('icon'),
  ...audit,
})

export const tags = pgTable('tags', {
  id: text('id').primaryKey(),
  title: text('title'),
  description: text('description'),
  color: text('color'),
  ...audit,
})

export const invoices = pgTable('invoices', {
  id: text('id').primaryKey(),
  accountId: text('account_id')
    .notNull()
    .references(() => accounts.id),
  date: timestamp('date', { mode: 'string' }).notNull(),
  paymentDate: timestamp('payment_date', { mode: 'string' }),
  value: numeric('value', { mode: 'number' }).notNull().default(0),
})

export const subCards = pgTable('sub_cards', {
  id: text('id').primaryKey(),
  accountId: text('account_id')
    .notNull()
    .references(() => accounts.id),
  last4: varchar('last4', { length: 4 }),
  holderName: text('holder_name'),
  cardType: varchar('card_type', { length: 50 }),
  ...audit,
})

export const transactions = pgTable('transactions', {
  id: text('id').primaryKey(),
  description: varchar('description', { length: 255 }),
  dueDate: timestamp('due_date', { mode: 'string' }).notNull(),
  paidOut: boolean('paid_out').notNull().default(false),
  value: numeric('value', { mode: 'number' }).notNull(),
  accountId: text('account_id')
    .notNull()
    .references(() => accounts.id),
  transactionFrom: text('transaction_from'),
  categoryId: text('category_id').references(() => categories.id),
  invoiceId: text('invoice_id').references(() => invoices.id),
  subCardId: text('sub_card_id').references(() => subCards.id),
  ...audit,
})

// Recurrence engine (SplitFixedTransactions/LoopUntil) is out of MVP scope — table exists for
// schema completeness so a future phase can port it without a migration.
export const fixedTransactions = pgTable('fixed_transactions', {
  id: text('id').primaryKey(),
  description: text('description'),
  startDate: timestamp('start_date', { mode: 'string' }).notNull(),
  value: numeric('value', { mode: 'number' }).notNull(),
  accountId: text('account_id')
    .notNull()
    .references(() => accounts.id),
  categoryId: text('category_id').references(() => categories.id),
  frequencyType: integer('frequency_type').notNull().default(5),
  ...audit,
})

export const rules = pgTable('rules', {
  id: text('id').primaryKey(),
  name: text('name'),
  pattern: varchar('pattern', { length: 255 }).notNull(),
  matchType: integer('match_type').notNull().default(0),
  categoryId: text('category_id').references(() => categories.id),
  priority: integer('priority').notNull().default(0),
  active: boolean('active').notNull().default(true),
  ...audit,
})

export const accountTag = pgTable(
  'account_tag',
  {
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { mode: 'string' }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.tagId] })],
)

export const transactionTags = pgTable(
  'transaction_tags',
  {
    transactionId: text('transaction_id')
      .notNull()
      .references(() => transactions.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { mode: 'string' }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.transactionId, t.tagId] })],
)

export const fixedTransactionTags = pgTable(
  'fixed_transaction_tags',
  {
    fixedTransactionId: text('fixed_transaction_id')
      .notNull()
      .references(() => fixedTransactions.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { mode: 'string' }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.fixedTransactionId, t.tagId] })],
)
