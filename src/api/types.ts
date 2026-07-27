// core-api's controllers use ASP.NET Core's default JSON options (System.Text.Json,
// no custom naming policy configured anywhere in Startup.cs), which camelCases every
// response property automatically. These types mirror the actual wire format, not the
// PascalCase C# member names.

export const TypeAccount = {
  Account: 0,
  Card: 1,
} as const
export type TypeAccount = (typeof TypeAccount)[keyof typeof TypeAccount]

export const TypeTransaction = {
  Revenue: 0,
  Expenses: 1,
  Transfer: 2,
  Card: 3,
} as const
export type TypeTransaction = (typeof TypeTransaction)[keyof typeof TypeTransaction]

export const RecurrencyType = {
  Fixed: 0,
  Terms: 1,
} as const
export type RecurrencyType = (typeof RecurrencyType)[keyof typeof RecurrencyType]

export const FrequencyType = {
  Yearly: 1,
  SemiAnnual: 2,
  TriMonthly: 3,
  Bimonthly: 4,
  Monthly: 5,
  BiWeekly: 6,
  Weekly: 7,
  Daily: 8,
} as const
export type FrequencyType = (typeof FrequencyType)[keyof typeof FrequencyType]

export interface AccountTagContract {
  id: string
  title: string
  color: string
}

export interface SubCardContract {
  id: string
  last4: string
  holderName: string
  cardType: string
}

export interface AccountResponse {
  id: string
  name: string
  description: string
  initialValue: number
  value: number
  typeAccount: TypeAccount
  limit: number
  closure: number
  dueDate: number
  institutionId: string
  isDefault: boolean
  accountTags: AccountTagContract[]
  subCards: SubCardContract[]
}

export interface DashBoard {
  labels: string[]
  value: number[]
}

export interface CashFlowContract {
  total: number
  accounts: AccountResponse[]
  cards: AccountResponse[]
  dashBoard: DashBoard | null
}

export interface TransactionTagContract {
  id: string
  title: string
  color: string
}

export interface TransactionContract {
  id: string
  // Classification (Revenue/Expenses/Transfer/Card) actually used by GetTransactions —
  // computed server-side by GetType(value, categoryId). `value` is a signed amount
  // already (positive = credit, negative = debit); it is not a magnitude to re-sign.
  type: TypeTransaction
  description: string
  value: number
  account: string
  accountId: string
  accountTo: string
  paidOut: boolean
  // Present on the DTO but hardcoded to 0 by GetAccountTransactions/GetAccountTransactionsFromFixed
  // for this endpoint — not meaningful here, only used by the (unrelated) GetById code path.
  typeTransaction: number
  dueDate: string
  categoryId: string
  categoryName: string
  icon: string
  color: string
  // Only populated by GetInvoices (card statement) — always null on GetTransactions/GetById,
  // since those don't project Transaction.SubCard.
  subCardId: string | null
  subCardLast4: string | null
  subCardHolderName: string | null
  transactionTags: TransactionTagContract[]
  accountTags: TransactionTagContract[]
  recurrencyType: RecurrencyType | null
  frequencyType: FrequencyType
  // Only populated by GetInvoicePreview — null for every real transaction.
  previewSource: 'Fixed' | 'Installment' | 'CategoryAverage' | null
}

export interface TransactionTotalByAccount {
  accountId: string
  totalPreviousMonth: number
  totalExpectedPreviousMonth: number
}

export interface TransactionResponse {
  previousMonthSummary: TransactionTotalByAccount[]
  transactions: TransactionContract[]
}

export interface TransactionInvoiceResponse {
  invoiceId: string
  name: string
  dueDate: string
  value: number
  payment: boolean
  valuePayment: number
  transactions: TransactionContract[]
}

export interface ImportItauFaturaResponse {
  transactionsImported: number
  transactionsDeleted: number
  totalValue: number
  invoiceMonth: number
  invoiceYear: number
  skippedPreviousPaymentValue: number | null
  skippedPreviousPaymentDate: string | null
}

export interface ImportOfxResponse {
  transactionsImported: number
  transactionsSkipped: number
  totalValue: number
}

export interface TagResponse {
  id: string
  title: string
  description: string
  color: string
}

export interface CategoryResponse {
  id: string
  name: string
  color: string
  icon: string
  description: string
  parentId: string | null
  children: CategoryResponse[]
}

export interface AuthenticateRequest {
  Email: string
  Password: string
}

export interface AuthenticateResponse {
  token: string
}

export interface JwtGroupClaim {
  id: string
  name: string
  url: string
  // Not a typo: the backend serializes this one group of claims with
  // Newtonsoft.Json using an anonymous object that aliases id/name/url to
  // lowercase but leaves `CreatedDate` unaliased, so it keeps its original
  // PascalCase name on the wire (see ApplicationClaimsIdentityFactory.cs).
  CreatedDate: string
}

export interface JwtPayload {
  Groups: string
  Name: string
  Email: string
  [key: string]: unknown
}
