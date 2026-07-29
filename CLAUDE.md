# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Steppwize is a personal-finance PWA. It is a **local-first client-side port of a legacy ASP.NET Core
backend** ("core-api", not in this repo) — there is no server for app data. All persistence, business
logic, and query shaping that used to live in the backend now runs in the browser against an embedded
Postgres.

- `@electric-sql/pglite` runs a real Postgres build (via wasm) inside a Web Worker
  ([src/db/pglite.worker.ts](src/db/pglite.worker.ts)), persisted to IndexedDB.
- `drizzle-orm` (pglite driver) provides the query builder against the schema in
  [src/db/schema.ts](src/db/schema.ts).
- Deploys as a PWA (vite-plugin-pwa) to Cloudflare Pages on every push to `main`
  ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)).

Because this is a rewrite, correctness is judged against the old backend's behavior, not a spec.
Comments throughout the codebase call out exactly which core-api class/method a piece of logic or a
wire-format quirk was ported from (e.g. `TransactionService.GetType`, `CategoryService.GetDefaultCategories`).
Preserve those references when touching the code they annotate, and treat them as the reason certain
things look odd (hardcoded fields, unusual casing, fixed UUIDs) rather than cleaning them up.

## Commands

```bash
npm run dev       # start Vite dev server
npm run build     # tsc -b (project references) + vite build
npm run lint      # oxlint
npm run preview   # preview a production build
```

There is no test runner configured in this project. Verify changes to DB/query logic with the dev
server and, if needed, the ad-hoc inspection script:

```bash
node check-rules.mjs <path-to-pglite-datadir-blob>
```

This loads a PGlite data directory dump and prints rules/categories/transaction-category breakdown —
useful for sanity-checking migrations, seed data, or rule matching against a real exported backup.

## Architecture

### Layering

`pages/` → `hooks/` (React Query) → `api/` (thin pass-through) → `services/` (business logic, queries
the DB directly) → `db/` (drizzle schema + PGlite client).

- `api/*.ts` is a thin, mostly redundant layer over `services/*.ts` — it exists to mirror the shape of
  the old backend's HTTP endpoints. Don't put logic here; put it in `services/`.
- `services/*.ts` talk to Postgres directly via `db` from [src/db/client.ts](src/db/client.ts) using
  drizzle queries — there is no HTTP call anywhere in this layer.
- `hooks/*.ts` wrap service calls in `@tanstack/react-query` (`useQuery`/`useMutation`).
- Wire-format types in [src/api/types.ts](src/api/types.ts) intentionally mirror core-api's
  System.Text.Json camelCase DTOs (`TransactionContract`, `AccountResponse`, etc.), including fields
  that are dead/always-null/hardcoded on certain code paths — those are documented inline per-field.

### Database bootstrap and lifecycle

- [src/db/client.ts](src/db/client.ts) constructs a singleton `PGliteWorker` the moment it's imported.
  This ordering matters — see below.
- [src/db/migrate.ts](src/db/migrate.ts) applies hand-written idempotent `CREATE TABLE IF NOT EXISTS`
  DDL (not drizzle-kit generated migrations — drizzle-kit's migrator needs to read `.sql` files from
  disk, which doesn't exist in a browser bundle). `schema.ts` is the source of truth for column shapes;
  keep the DDL in `migrate.ts` in sync with it by hand.
- [src/db/seed.ts](src/db/seed.ts) seeds default categories/tags/accounts on first run only (checked
  via `seedIfEmpty`). Two category IDs are fixed UUIDs (`CARD_CATEGORY_ID`, `TRANSFER_CATEGORY_ID` in
  `schema.ts`) because core-api's transaction-type classification depends on literal category IDs —
  don't regenerate them.
- [src/main.tsx](src/main.tsx) orchestrates startup order deliberately: check for a staged backup
  restore → apply it directly to IndexedDB → *then* import `db/client` (which spins up the
  `PGliteWorker`) → migrate/seed → render `App`. Don't reorder these imports; `db/client` must not be
  imported before a pending restore is applied, since it opens a Postgres connection/Web Lock against
  the same IndexedDB store.

### Backup / restore

Export ([src/backup/export.ts](src/backup/export.ts)) dumps the whole PGlite data directory as a
gzipped tarball via `pg.dumpDataDir` (`createBackupBlob` returns the blob + filename; `exportBackup`
triggers the browser download). Restore can't apply in place — the live `PGliteWorker` holds a lock on
the IndexedDB store — so [src/backup/restore.ts](src/backup/restore.ts) stages the uploaded file in a
separate plain IndexedDB store ([src/db/restoreStaging.ts](src/db/restoreStaging.ts)), closes the PGlite
connection, and reloads the page; `main.tsx` picks up the staged file on the next boot before any PGlite
connection exists. `restoreBackup` takes a plain `File` regardless of where it came from (local picker or
a Google Drive download), so [src/pages/BackupPage.tsx](src/pages/BackupPage.tsx) funnels both sources
through one confirm modal.

Google Drive is an optional second destination for the same tarball, added without a backend:
- [src/backup/googleAuth.ts](src/backup/googleAuth.ts) wraps Google Identity Services' *token model*
  (`google.accounts.oauth2.initTokenClient`, loaded at runtime from `accounts.google.com/gsi/client` —
  not an npm dep). This flow has **no refresh token**; the access token lives in memory for the tab only
  and is re-requested via a user-gesture popup once it's near expiry. `isDriveConfigured` gates the
  feature on `VITE_GOOGLE_CLIENT_ID` being set at build time — a public client ID, not a secret; there is
  no client secret anywhere in this flow, don't add one.
- [src/backup/googleDrive.ts](src/backup/googleDrive.ts) talks to the Drive v3 REST API directly over
  `fetch` (no `googleapis` dep). It requests only the `drive.file` scope (non-sensitive — the app can
  only see files/folders it created itself), keeps backups in a `Steppwize Backups` folder in the user's
  My Drive, uploads via the resumable protocol (PGlite dumps can exceed the multipart 5 MB cap), and
  prunes to the 10 most recent backups after each upload.
- Local dev needs `VITE_GOOGLE_CLIENT_ID` in `.env.local` (see `.env.example`); CI injects it from the
  `VITE_GOOGLE_CLIENT_ID` GitHub secret in [.github/workflows/deploy.yml](.github/workflows/deploy.yml).
  Setup (OAuth client, Drive API enablement, consent screen scope) is one-time and manual in Google Cloud
  Console — there's no code path that does it.

### Dates

core-api used naive (timezone-less) `DateTime` throughout. [src/services/dates.ts](src/services/dates.ts)
has hand-rolled `toNaiveTimestamp`/`parseNaiveTimestamp` helpers specifically to avoid
`Date.toISOString()`'s UTC shift (which would move a midnight timestamp to the wrong day in
negative-offset zones like Brazil). Always read/write transaction and invoice timestamps through these
helpers, never `toISOString()` or bare `new Date(str)`.

### Categorization rules

[src/services/ruleService.ts](src/services/ruleService.ts) matches transaction descriptions against
user-defined rules (substring or regex, ordered by priority) to auto-assign a category. Used both by
the Itaú import flow and as a standalone "apply rules" action over uncategorized transactions.

### Itaú statement import

[src/services/importItau.ts](src/services/importItau.ts) parses an Itaú credit-card statement `.xlsx`
(via `xlsx`/SheetJS) by locating labeled cells (`Vencimento`, a `Data`/`Lançamento` header row) rather
than fixed offsets, since the sheet has a varying preamble. It creates/updates one `invoices` row per
statement month, replaces that invoice's transactions wholesale on re-import, tracks sub-cards by last-4
digits, and runs each transaction through `ruleService` for auto-categorization. Known synthetic rows
("pagamento efetuado", installment-credit lines) are explicitly skipped rather than imported.

### Statement/account previews

When a card invoice or a bank-account month has no real transactions yet, the app estimates one
instead of showing empty. Both paths return a synthetic list of `TransactionContract`s tagged with
`previewSource` (`'Installment' | 'Fixed' | 'CategoryAverage'`), grouped/labeled by
[src/utils/previewGroups.ts](src/utils/previewGroups.ts) and rendered identically in
[src/pages/CardInvoicePage.tsx](src/pages/CardInvoicePage.tsx) and
[src/pages/TransactionsPage.tsx](src/pages/TransactionsPage.tsx).

- **Cards** — `getInvoicePreview` in [src/services/accountService.ts](src/services/accountService.ts)
  windows off the last real `invoices` row (no invoices table exists yet for the target month → no
  fixed calendar boundary). It detects known installments via the `[Parcela N de Total]` description
  convention (`previewSource: 'Installment'`), near-constant recurring charges via normalized-description
  grouping + a 15% value-variance tolerance (`'Fixed'`), then averages whatever's left per category over
  the lookback window (`'CategoryAverage'`).
- **Bank accounts** — `getAccountPreview` in the same file is the analogous entry point, but the window
  is just the calendar month (no invoices table for checking accounts) and "Fixed" is **not**
  auto-detected — it comes from user-managed rows in `fixed_transactions` (see below), since bank
  transactions have no installment-style description marker to key off of. Category-average grouping
  excludes any category already claimed by an active fixed transaction, to avoid double-counting.

### Fixed transactions (bank accounts only)

`fixed_transactions` now has a real service/UI layer
([src/services/fixedTransactionService.ts](src/services/fixedTransactionService.ts), managed from a
modal in `TransactionsPage.tsx`), but it's intentionally a light-weight feed for `getAccountPreview`
above — not a port of core-api's recurrence engine. Every row is forced to `frequencyType: Monthly` and
"applies" to a target month via a simple `startDate <= targetMonth` check; there is no `LoopUntil`/
`SplitFixedTransactions`-style expansion into concrete future `transactions` rows, no support for other
frequencies, and no card-account usage (cards get their "Fixed" group heuristically, see above).

## Conventions

- Routes and UI copy are in Portuguese (pt-BR); this targets Brazilian users specifically — keep new
  user-facing strings in Portuguese.
- Styling is Tailwind v4 (`@theme` tokens defined in [src/index.css](src/index.css): `bg`, `surface`,
  `card`, `border`, `muted`, `brand`, `positive`, `negative`) — prefer these semantic color tokens over
  raw Tailwind palette classes.
- TypeScript project is strict about unused code (`noUnusedLocals`/`noUnusedParameters`) and uses
  `verbatimModuleSyntax` — use `import type` for type-only imports.
