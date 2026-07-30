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
  // Bank statement (OFX) FITID, used to dedupe transactions on re-import. Null for transactions
  // created any other way (manual entry, Itaú fatura import).
  externalId: text('external_id'),
  ...audit,
})

// Recurrence engine (SplitFixedTransactions/LoopUntil) is out of MVP scope — table exists for
// schema completeness so a future phase can port it without a migration.
export const fixedTransactions = pgTable('fixed_transactions', {
  id: text('id').primaryKey(),
  description: text('description'),
  startDate: timestamp('start_date', { mode: 'string' }).notNull(),
  // Nullable: open-ended fixed transactions (rent, salary) have no end. Installments with a known
  // last month (e.g. a wedding vendor paid through Oct/2026) or single-month one-offs set this to
  // bound how far getAccountPreview projects them forward.
  endDate: timestamp('end_date', { mode: 'string' }),
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

// Single-row table (fixed id 'default') holding the user's configured LLM provider for the chat
// assistant. Unlike the Google Drive OAuth token (kept in-memory only, see backup/googleAuth.ts),
// this key is a long-lived credential the user expects to persist across reloads, so it goes
// through the same PGlite/IndexedDB store as everything else in this local-first app.
export const llmSettings = pgTable('llm_settings', {
  id: text('id').primaryKey(),
  provider: text('provider').notNull(),
  apiKey: text('api_key').notNull(),
  model: text('model').notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).notNull().defaultNow(),
})

// Single-row table (fixed id 'default') holding the assistant's conversation as one JSON blob —
// the whole `useChat` messages array, replace-on-write. A single conversation (no per-thread
// modeling) matches how ChatModal is used today; message `parts` already have arbitrary shapes
// (text, tool calls, approvals), so storing them as opaque JSON avoids modeling that structure
// relationally for no benefit in a single-user local app.
export const chatHistory = pgTable('chat_history', {
  id: text('id').primaryKey(),
  messages: text('messages').notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).notNull().defaultNow(),
})

// Freeform notes the chat assistant writes about itself via the `saveMemory` tool (services/chat/
// tools.ts) — durable context (user preferences, recurring corrections) it decides is worth
// persisting across conversations. Loaded into the agent's system prompt on every new session
// (services/chat/agent.ts), not just exposed as a tool result.
export const agentMemories = pgTable('agent_memories', {
  id: text('id').primaryKey(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).notNull().defaultNow(),
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
