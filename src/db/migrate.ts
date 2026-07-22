import { pg } from './client'
import { seedIfEmpty } from './seed'

// Hand-written idempotent DDL instead of drizzle-kit generated migration files: drizzle-kit's
// migrator expects to read .sql files from disk, which doesn't exist in a browser bundle. This
// runs once per fresh IndexedDB store; schema.ts stays the source of truth for column shapes.
const BOOTSTRAP_SQL = `
create table if not exists accounts (
  id text primary key,
  name text,
  description text,
  type_account integer not null default 0,
  initial_value numeric not null default 0,
  is_default boolean not null default false,
  "limit" numeric not null default 0,
  closure integer not null default 0,
  due_date integer not null default 0,
  institution_id text,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),
  deleted boolean not null default false
);

create table if not exists categories (
  id text primary key,
  name text,
  color text,
  description text,
  parent_category text,
  icon text,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),
  deleted boolean not null default false
);

create table if not exists tags (
  id text primary key,
  title text,
  description text,
  color text,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),
  deleted boolean not null default false
);

create table if not exists invoices (
  id text primary key,
  account_id text not null references accounts(id),
  date timestamp not null,
  payment_date timestamp,
  value numeric not null default 0
);

create table if not exists sub_cards (
  id text primary key,
  account_id text not null references accounts(id),
  last4 varchar(4),
  holder_name text,
  card_type varchar(50),
  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),
  deleted boolean not null default false
);

create table if not exists transactions (
  id text primary key,
  description varchar(255),
  due_date timestamp not null,
  paid_out boolean not null default false,
  value numeric not null,
  account_id text not null references accounts(id),
  transaction_from text,
  category_id text references categories(id),
  invoice_id text references invoices(id),
  sub_card_id text references sub_cards(id),
  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),
  deleted boolean not null default false
);
create index if not exists idx_transactions_due_date on transactions(due_date);
create index if not exists idx_transactions_account_id on transactions(account_id);
create index if not exists idx_transactions_invoice_id on transactions(invoice_id);

create table if not exists fixed_transactions (
  id text primary key,
  description text,
  start_date timestamp not null,
  value numeric not null,
  account_id text not null references accounts(id),
  category_id text references categories(id),
  frequency_type integer not null default 5,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),
  deleted boolean not null default false
);

create table if not exists rules (
  id text primary key,
  name text,
  pattern varchar(255) not null,
  match_type integer not null default 0,
  category_id text references categories(id),
  priority integer not null default 0,
  active boolean not null default true,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),
  deleted boolean not null default false
);
create index if not exists idx_rules_priority on rules(priority);

create table if not exists account_tag (
  account_id text not null references accounts(id) on delete cascade,
  tag_id text not null references tags(id) on delete cascade,
  created_at timestamp not null default now(),
  primary key (account_id, tag_id)
);

create table if not exists transaction_tags (
  transaction_id text not null references transactions(id) on delete cascade,
  tag_id text not null references tags(id) on delete cascade,
  created_at timestamp not null default now(),
  primary key (transaction_id, tag_id)
);

create table if not exists fixed_transaction_tags (
  fixed_transaction_id text not null references fixed_transactions(id) on delete cascade,
  tag_id text not null references tags(id) on delete cascade,
  created_at timestamp not null default now(),
  primary key (fixed_transaction_id, tag_id)
);
`

let migratedPromise: Promise<void> | null = null

export function ensureMigratedAndSeeded(): Promise<void> {
  if (!migratedPromise) {
    migratedPromise = (async () => {
      await pg.exec(BOOTSTRAP_SQL)
      await seedIfEmpty()
    })()
  }
  return migratedPromise
}
