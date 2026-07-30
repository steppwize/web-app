import { useMemo, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
  Plus,
  Repeat,
  Pencil,
  Trash2,
  CreditCard,
} from 'lucide-react'
import {
  useTransactions,
  useCreateTransaction,
  useUpdateTransaction,
  useUpdateTransactionCategory,
  useDeleteTransaction,
} from '../hooks/useTransactions'
import { useHomeCashFlow } from '../hooks/useHomeCashFlow'
import { useAccountPreview } from '../hooks/useAccountPreview'
import { useCardsPreview } from '../hooks/useCardsPreview'
import {
  useFixedTransactions,
  useCreateFixedTransaction,
  useUpdateFixedTransaction,
  useDeleteFixedTransaction,
} from '../hooks/useFixedTransactions'
import { useAccounts } from '../hooks/useAccounts'
import { useCategories } from '../hooks/useCategories'
import { comingSoon, useToastStore } from '../store/toastStore'
import { Card } from '../components/ui/Card'
import { IconCircle } from '../components/ui/IconCircle'
import { Toggle } from '../components/ui/Toggle'
import { formatCurrency, formatSignedCurrency } from '../utils/currency'
import { formatDayHeader, formatFullDate, formatMonthYear } from '../utils/date'
import { computeMonthSummary, computeDayGroups, type DayGroup } from '../utils/monthSummary'
import { resolveCategoryIcon } from '../utils/categoryIcon'
import { groupPreviewTransactions, previewSourceLabel } from '../utils/previewGroups'
import type { FixedTransactionInput } from '../api/fixedTransactions'
import type { TransactionInput } from '../api/transactions'
import { TypeAccount } from '../api/types'
import type { CategoryResponse, FixedTransactionResponse, TransactionContract } from '../api/types'
import type { CardPreviewGroup } from '../services/accountService'

// One merged day in the account's day-by-day preview: real DayGroup transactions plus any card
// whose invoice due date (see getCardsPreview) falls on this day, collapsed to a single row —
// its per-category breakdown lives behind the row's click-through modal instead of the day list.
interface PreviewDayGroup {
  dateKey: string
  transactions: TransactionContract[]
  cards: CardPreviewGroup[]
  endOfDayBalance: number
}

export function TransactionsPage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [query, setQuery] = useState('')
  const [showEodBalance, setShowEodBalance] = useState(true)
  const [fixedModalOpen, setFixedModalOpen] = useState(false)
  const [selectedCardPreview, setSelectedCardPreview] = useState<CardPreviewGroup | null>(null)
  const [txFormOpen, setTxFormOpen] = useState(false)
  const [editingTx, setEditingTx] = useState<TransactionContract | null>(null)
  const [categoryEditTx, setCategoryEditTx] = useState<TransactionContract | null>(null)
  const [pendingDeleteTx, setPendingDeleteTx] = useState<TransactionContract | null>(null)

  const { data: txData, isLoading, isError } = useTransactions(month, year)
  const { data: cashFlow } = useHomeCashFlow()
  const { data: accounts } = useAccounts()
  const { data: categories } = useCategories()
  const createTx = useCreateTransaction()
  const updateTx = useUpdateTransaction()
  const deleteTx = useDeleteTransaction()

  const bankAccounts = useMemo(() => (accounts ?? []).filter((a) => a.typeAccount === TypeAccount.Account), [accounts])
  const flatCategories = useMemo(() => (categories ? flattenCategories(categories) : []), [categories])

  function openCreateTransaction() {
    setEditingTx(null)
    setTxFormOpen(true)
  }

  function openEditTransaction(tx: TransactionContract) {
    setEditingTx(tx)
    setTxFormOpen(true)
  }

  function handleTxSubmit(input: TransactionInput) {
    if (editingTx) {
      updateTx.mutate(
        { id: editingTx.id, input },
        {
          onSuccess: () => {
            useToastStore.getState().show('Transação atualizada.')
            setTxFormOpen(false)
          },
          onError: (error) =>
            useToastStore.getState().show(error instanceof Error ? error.message : 'Falha ao salvar transação.'),
        },
      )
    } else {
      createTx.mutate(input, {
        onSuccess: () => {
          useToastStore.getState().show('Transação criada.')
          setTxFormOpen(false)
        },
        onError: (error) =>
          useToastStore.getState().show(error instanceof Error ? error.message : 'Falha ao salvar transação.'),
      })
    }
  }

  function handleDeleteTx() {
    if (!pendingDeleteTx) return
    deleteTx.mutate(pendingDeleteTx.id, {
      onSuccess: () => {
        useToastStore.getState().show('Transação removida.')
        setPendingDeleteTx(null)
      },
      onError: (error) => {
        useToastStore.getState().show(error instanceof Error ? error.message : 'Falha ao remover transação.')
        setPendingDeleteTx(null)
      },
    })
  }

  const monthSummary = useMemo(() => (txData ? computeMonthSummary(txData) : null), [txData])
  const isEmptyMonth = !!txData && txData.transactions.length === 0

  const { data: preview, isLoading: isPreviewLoading } = useAccountPreview(year, month, { enabled: isEmptyMonth })
  // Preview items get spread across plausible days of the target month (see accountService.ts),
  // so the account preview renders as a day-by-day forecast (`reverse: false`: day 1 first, since
  // this looks forward, not back).
  const accountPreviewDayGroups = useMemo(
    () => computeDayGroups(preview?.transactions ?? [], monthSummary?.startingBalance ?? 0, { reverse: false }),
    [preview, monthSummary],
  )

  // Independent of the account preview above: each card decides on its own (server-side) whether
  // it has real invoice data for this month, regardless of whether the bank account does.
  const { data: cardsPreview } = useCardsPreview(year, month)
  const hasAnyPreviewData = (preview?.transactions.length ?? 0) > 0 || (cardsPreview?.length ?? 0) > 0

  // Merges each card into the single day matching its own invoice due date (accounts.dueDate),
  // as one collapsed row rather than its full category breakdown — that breakdown is only shown
  // in the click-through modal (CardPreviewModal) so the day list doesn't get crowded with it.
  const previewDayGroups = useMemo<PreviewDayGroup[]>(() => {
    const accountByDate = new Map(accountPreviewDayGroups.map((g) => [g.dateKey, g]))
    const cardsByDate = new Map<string, CardPreviewGroup[]>()
    for (const card of cardsPreview ?? []) {
      const key = card.dueDate.slice(0, 10)
      const list = cardsByDate.get(key) ?? []
      list.push(card)
      cardsByDate.set(key, list)
    }

    const sortedKeys = [...new Set([...accountByDate.keys(), ...cardsByDate.keys()])].sort()

    let runningBalance = monthSummary?.startingBalance ?? 0
    return sortedKeys.map((dateKey) => {
      const accountGroup = accountByDate.get(dateKey)
      if (accountGroup) runningBalance = accountGroup.endOfDayBalance
      return {
        dateKey,
        transactions: accountGroup?.transactions ?? [],
        cards: cardsByDate.get(dateKey) ?? [],
        endOfDayBalance: runningBalance,
      }
    })
  }, [accountPreviewDayGroups, cardsPreview, monthSummary])

  const filteredGroups = useMemo(() => {
    if (!monthSummary) return []
    const q = query.trim().toLowerCase()
    if (!q) return monthSummary.dayGroups
    return monthSummary.dayGroups
      .map((group) => ({
        ...group,
        transactions: group.transactions.filter((tx) => tx.description.toLowerCase().includes(q)),
      }))
      .filter((group) => group.transactions.length > 0)
  }, [monthSummary, query])

  const filteredPreviewDayGroups = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return previewDayGroups
    return previewDayGroups
      .map((group) => ({
        ...group,
        transactions: group.transactions.filter((tx) => tx.description.toLowerCase().includes(q)),
        cards: group.cards.filter((c) => c.cardName.toLowerCase().includes(q)),
      }))
      .filter((group) => group.transactions.length > 0 || group.cards.length > 0)
  }, [previewDayGroups, query])

  const displayedProjectedBalance =
    (monthSummary?.projectedEndBalance ?? 0) + (isEmptyMonth ? (preview?.value ?? 0) : 0)

  function goToPreviousMonth() {
    if (month === 1) {
      setMonth(12)
      setYear((y) => y - 1)
    } else {
      setMonth((m) => m - 1)
    }
  }

  function goToNextMonth() {
    if (month === 12) {
      setMonth(1)
      setYear((y) => y + 1)
    } else {
      setMonth((m) => m + 1)
    }
  }

  if (isLoading) return <CenteredMessage text="Carregando..." />
  if (isError || !monthSummary) return <CenteredMessage text="Não foi possível carregar suas transações." />

  return (
    <div>
      {fixedModalOpen && <FixedTransactionsModal onClose={() => setFixedModalOpen(false)} />}
      {selectedCardPreview && (
        <CardPreviewModal card={selectedCardPreview} onClose={() => setSelectedCardPreview(null)} />
      )}
      {txFormOpen && (
        <TransactionFormModal
          initial={
            editingTx
              ? {
                  description: editingTx.description,
                  value: editingTx.value,
                  accountId: editingTx.accountId,
                  categoryId: editingTx.categoryId || null,
                  dueDate: editingTx.dueDate.slice(0, 10),
                  paidOut: editingTx.paidOut,
                }
              : { ...EMPTY_TX_FORM, accountId: bankAccounts[0]?.id ?? '', dueDate: todayDateInputValue() }
          }
          title={editingTx ? 'Editar transação' : 'Nova transação'}
          isEditing={!!editingTx}
          pending={createTx.isPending || updateTx.isPending}
          accounts={bankAccounts}
          categories={flatCategories}
          onCancel={() => setTxFormOpen(false)}
          onSubmit={handleTxSubmit}
          onDelete={
            editingTx
              ? () => {
                  setTxFormOpen(false)
                  setPendingDeleteTx(editingTx)
                }
              : undefined
          }
        />
      )}
      {pendingDeleteTx && (
        <ConfirmDeleteTransactionModal
          transaction={pendingDeleteTx}
          pending={deleteTx.isPending}
          onCancel={() => setPendingDeleteTx(null)}
          onConfirm={handleDeleteTx}
        />
      )}
      {categoryEditTx && (
        <CategoryQuickEditModal transaction={categoryEditTx} onClose={() => setCategoryEditTx(null)} />
      )}

      {/* Mobile */}
      <div className="lg:hidden flex flex-col h-screen">
        <div className="flex flex-col gap-3 px-4 pt-4">
          <div className="flex items-center justify-between">
            <button onClick={goToPreviousMonth}>
              <ChevronLeft size={24} />
            </button>
            <h1 className="text-lg font-bold">{formatMonthYear(month, year)}</h1>
            <button onClick={goToNextMonth}>
              <ChevronRight size={24} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 h-11 px-3 rounded-xl bg-card">
              <Search size={18} className="text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar transação..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
              />
            </div>
            <button
              onClick={() => setFixedModalOpen(true)}
              aria-label="Gerenciar fixos"
              title="Gerenciar fixos"
              className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl bg-card"
            >
              <Repeat size={18} />
            </button>
            <button
              onClick={comingSoon}
              className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl bg-card"
            >
              <SlidersHorizontal size={18} />
            </button>
          </div>

          <div className="flex items-center justify-between pb-2">
            <span className="text-xs text-muted">Saldo fim do dia</span>
            <Toggle checked={showEodBalance} onChange={setShowEodBalance} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-32">
          {isEmptyMonth ? (
            <AccountPreviewSection
              dayGroups={filteredPreviewDayGroups}
              value={preview?.value}
              loading={isPreviewLoading}
              hasAnyPreviewData={hasAnyPreviewData}
              showEodBalance={showEodBalance}
              variant="list"
              onSelectCard={setSelectedCardPreview}
            />
          ) : (
            <TransactionGroups
              groups={filteredGroups}
              showEodBalance={showEodBalance}
              onEditCategory={setCategoryEditTx}
              onEditTransaction={openEditTransaction}
            />
          )}
        </div>

        <div className="fixed bottom-24 left-0 right-0 flex items-center justify-between px-5 h-[72px] bg-surface border-t border-border">
          <div className="flex flex-col">
            <span className="text-xs text-muted">Saldo atual</span>
            <span className="text-base font-bold text-positive">{formatCurrency(cashFlow?.total ?? 0)}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-xs text-muted">Previsto fim do mês</span>
            <span className="text-base font-bold text-positive">{formatCurrency(displayedProjectedBalance)}</span>
          </div>
        </div>

        <button
          onClick={openCreateTransaction}
          className="fixed bottom-32 right-5 w-14 h-14 rounded-full bg-brand flex items-center justify-center shadow-lg"
        >
          <Plus size={24} />
        </button>
      </div>

      {/* Desktop */}
      <div className="hidden lg:flex flex-col gap-6 p-8 h-screen">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold">Transações</h1>
            <div className="flex items-center gap-3 text-sm text-muted">
              <button onClick={goToPreviousMonth}>
                <ChevronLeft size={18} />
              </button>
              <span className="text-white font-medium">{formatMonthYear(month, year)}</span>
              <button onClick={goToNextMonth}>
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2 h-10 w-[220px] px-3 rounded-[10px] bg-card border border-border">
              <Search size={16} className="text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar transação..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
              />
            </div>
            <button
              onClick={comingSoon}
              className="w-10 h-10 flex items-center justify-center rounded-[10px] bg-card border border-border"
            >
              <SlidersHorizontal size={16} />
            </button>
            <button
              onClick={() => setFixedModalOpen(true)}
              className="flex items-center gap-2 h-10 px-4 rounded-[10px] bg-card border border-border text-sm font-semibold"
            >
              <Repeat size={16} /> Fixos
            </button>
            <div className="flex items-center gap-2 text-sm text-muted">
              <span>Saldo fim do dia</span>
              <Toggle checked={showEodBalance} onChange={setShowEodBalance} />
            </div>
            <button
              onClick={openCreateTransaction}
              className="flex items-center gap-2 h-10 px-4 rounded-[10px] bg-brand text-sm font-semibold"
            >
              <Plus size={16} /> Nova Transação
            </button>
          </div>
        </div>

        <div className="flex-1 flex gap-5 min-h-0">
          <Card className="flex-1 overflow-y-auto">
            {isEmptyMonth ? (
              <div className="flex flex-col gap-2 px-4 py-3">
                <AccountPreviewSection
                  dayGroups={filteredPreviewDayGroups}
                  value={preview?.value}
                  loading={isPreviewLoading}
                  hasAnyPreviewData={hasAnyPreviewData}
                  showEodBalance={showEodBalance}
                  variant="table"
                  onSelectCard={setSelectedCardPreview}
                />
              </div>
            ) : (
              <TransactionTable
                groups={filteredGroups}
                showEodBalance={showEodBalance}
                onEditCategory={setCategoryEditTx}
                onEditTransaction={openEditTransaction}
              />
            )}
          </Card>

          <div className="w-[280px] shrink-0 flex flex-col gap-3">
            <Card className="p-5 flex flex-col gap-4">
              <h2 className="text-sm font-semibold">Resumo do Mês</h2>
              <SummaryRow label="Receitas" display={formatSignedCurrency(monthSummary.totalRevenue)} tone="positive" />
              <SummaryRow
                label="Despesas"
                display={formatSignedCurrency(-monthSummary.totalExpenses)}
                tone="negative"
              />
            </Card>
            <Card className="p-5 flex flex-col gap-4">
              <h2 className="text-sm font-semibold">Saldo</h2>
              <SummaryRow label="Saldo atual" display={formatCurrency(cashFlow?.total ?? 0)} tone="positive" />
              <SummaryRow
                label="Previsto fim do mês"
                display={formatCurrency(displayedProjectedBalance)}
                tone="positive"
              />
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

function CenteredMessage({ text }: { text: string }) {
  return <div className="flex items-center justify-center min-h-[60vh] text-sm text-muted">{text}</div>
}

function TransactionGroups({
  groups,
  showEodBalance,
  onEditCategory,
  onEditTransaction,
}: {
  groups: DayGroup[]
  showEodBalance: boolean
  onEditCategory: (tx: TransactionContract) => void
  onEditTransaction: (tx: TransactionContract) => void
}) {
  if (groups.length === 0) {
    return <p className="text-sm text-muted text-center pt-8">Nenhuma transação encontrada.</p>
  }
  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <div key={group.dateKey} className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold tracking-wide text-muted">
            {formatDayHeader(group.dateKey)}
          </span>
          {group.transactions.map((tx) => (
            <TransactionRow
              key={tx.id}
              transaction={tx}
              onEditCategory={onEditCategory}
              onEditTransaction={onEditTransaction}
            />
          ))}
          {showEodBalance && (
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-brand/5 border border-brand/25">
              <span className="text-xs text-brand-light">Saldo fim do dia</span>
              <span
                className={`text-xs font-semibold ${
                  group.endOfDayBalance >= 0 ? 'text-positive' : 'text-negative'
                }`}
              >
                {formatSignedCurrency(group.endOfDayBalance)}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function TransactionRow({
  transaction,
  onEditCategory,
  onEditTransaction,
}: {
  transaction: TransactionContract
  onEditCategory?: (tx: TransactionContract) => void
  onEditTransaction?: (tx: TransactionContract) => void
}) {
  const Icon = resolveCategoryIcon(transaction.icon)
  const value = transaction.value
  const color = transaction.color || '#8B8FA8'
  // Preview/synthetic rows aren't backed by a real transactions row, so neither affordance applies.
  const editable = !transaction.previewSource

  return (
    <div
      onClick={editable && onEditTransaction ? () => onEditTransaction(transaction) : undefined}
      className={`flex items-center gap-3 h-[68px] px-3 rounded-xl bg-card ${
        editable && onEditTransaction ? 'cursor-pointer' : ''
      }`}
    >
      <button
        type="button"
        disabled={!editable || !onEditCategory}
        onClick={(e) => {
          e.stopPropagation()
          if (editable) onEditCategory?.(transaction)
        }}
        aria-label="Trocar categoria"
        className="shrink-0 disabled:cursor-default"
      >
        <IconCircle background={`${color}20`} size={40}>
          <Icon size={18} style={{ color }} />
        </IconCircle>
      </button>
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm font-semibold truncate">{transaction.description}</span>
          <PreviewBadge source={transaction.previewSource} />
        </span>
        <span className="text-xs text-muted truncate">{transaction.categoryName}</span>
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <span className={`text-sm font-semibold ${value >= 0 ? 'text-positive' : 'text-negative'}`}>
          {formatSignedCurrency(value)}
        </span>
        {!transaction.previewSource && (
          <span
            className={`w-[9px] h-[9px] rounded-full ${
              transaction.paidOut ? 'bg-positive' : 'border border-muted'
            }`}
          />
        )}
      </div>
    </div>
  )
}

function TransactionTable({
  groups,
  showEodBalance,
  onEditCategory,
  onEditTransaction,
}: {
  groups: DayGroup[]
  showEodBalance: boolean
  onEditCategory: (tx: TransactionContract) => void
  onEditTransaction: (tx: TransactionContract) => void
}) {
  if (groups.length === 0) {
    return <p className="text-sm text-muted text-center py-8">Nenhuma transação encontrada.</p>
  }
  return (
    <div className="flex flex-col">
      <div className="flex items-center h-11 px-4 bg-surface text-xs font-semibold text-muted">
        <span className="flex-1">Transação</span>
        <span className="w-32">Categoria</span>
        <span className="w-32 text-right">Valor</span>
        <span className="w-16 text-center">Status</span>
      </div>
      {groups.map((group) => (
        <div key={group.dateKey}>
          <div className="flex items-center h-9 px-4 bg-bg text-[11px] font-semibold text-muted tracking-wide">
            {formatDayHeader(group.dateKey)}
          </div>
          {group.transactions.map((tx) => (
            <TransactionTableRow
              key={tx.id}
              transaction={tx}
              onEditCategory={onEditCategory}
              onEditTransaction={onEditTransaction}
            />
          ))}
          {showEodBalance && (
            <div className="flex items-center justify-between h-9 px-4 bg-brand/5 border-y border-brand/25">
              <span className="text-xs text-brand-light">Saldo fim do dia</span>
              <span
                className={`text-xs font-semibold ${
                  group.endOfDayBalance >= 0 ? 'text-positive' : 'text-negative'
                }`}
              >
                {formatSignedCurrency(group.endOfDayBalance)}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function TransactionTableRow({
  transaction,
  onEditCategory,
  onEditTransaction,
}: {
  transaction: TransactionContract
  onEditCategory?: (tx: TransactionContract) => void
  onEditTransaction?: (tx: TransactionContract) => void
}) {
  const Icon = resolveCategoryIcon(transaction.icon)
  const value = transaction.value
  const color = transaction.color || '#8B8FA8'
  const editable = !transaction.previewSource

  return (
    <div
      onClick={editable && onEditTransaction ? () => onEditTransaction(transaction) : undefined}
      className={`flex items-center h-14 px-4 border-b border-border ${
        editable && onEditTransaction ? 'cursor-pointer' : ''
      }`}
    >
      <div className="flex-1 flex items-center gap-3 min-w-0">
        <button
          type="button"
          disabled={!editable || !onEditCategory}
          onClick={(e) => {
            e.stopPropagation()
            if (editable) onEditCategory?.(transaction)
          }}
          aria-label="Trocar categoria"
          className="shrink-0 disabled:cursor-default"
        >
          <IconCircle background={`${color}20`} size={32}>
            <Icon size={15} style={{ color }} />
          </IconCircle>
        </button>
        <div className="flex flex-col min-w-0">
          <span className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm font-semibold truncate">{transaction.description}</span>
            <PreviewBadge source={transaction.previewSource} />
          </span>
          <span className="text-xs text-muted truncate">
            {transaction.account}
            {transaction.previewEndDate ? ` · até ${formatFullDate(transaction.previewEndDate)}` : ''}
          </span>
        </div>
      </div>
      <span className="w-32 text-sm text-muted truncate">{transaction.categoryName}</span>
      <span className={`w-32 text-right text-sm font-semibold ${value >= 0 ? 'text-positive' : 'text-negative'}`}>
        {formatSignedCurrency(value)}
      </span>
      <span className="w-16 flex items-center justify-center">
        {!transaction.previewSource && (
          <span
            className={`w-[9px] h-[9px] rounded-full ${
              transaction.paidOut ? 'bg-positive' : 'border border-muted'
            }`}
          />
        )}
      </span>
    </div>
  )
}

function SummaryRow({
  label,
  display,
  tone,
}: {
  label: string
  display: string
  tone: 'positive' | 'negative'
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted">{label}</span>
      <span className={`text-sm font-semibold ${tone === 'positive' ? 'text-positive' : 'text-negative'}`}>
        {display}
      </span>
    </div>
  )
}

function PreviewBadge({ source }: { source: TransactionContract['previewSource'] }) {
  const label = previewSourceLabel(source)
  if (!label) return null
  return (
    <span className="shrink-0 h-[18px] flex items-center px-1.5 rounded text-[10px] font-semibold bg-muted/20 text-muted">
      {label}
    </span>
  )
}

function PreviewBanner({ value, loading }: { value: number | undefined; loading: boolean }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-card border border-dashed border-border text-xs">
      <span className="text-muted">Estimativa — mês ainda sem transações</span>
      {!loading && value !== undefined && (
        <span className="font-semibold">{formatSignedCurrency(value)}</span>
      )}
    </div>
  )
}

function PreviewGroupHeader({ label, subtotal }: { label: string; subtotal: number }) {
  return (
    <div className="flex items-center justify-between px-1 pt-2 pb-1">
      <span className="text-[11px] font-semibold text-muted uppercase tracking-wide">{label}</span>
      <span className={`text-xs font-semibold ${subtotal >= 0 ? 'text-positive' : 'text-negative'}`}>
        {formatSignedCurrency(subtotal)}
      </span>
    </div>
  )
}

// Renders the account preview as a day-by-day forecast — one row per estimated transaction plus
// one collapsed row per card due that day (see CardAggregateRow) — so an estimated month reads
// like any other, including the "Saldo fim do dia" running balance. Each transaction row still
// carries its own PreviewBadge (Fixo/Média) since day-grouping drops the old source-grouped headers.
function AccountPreviewSection({
  dayGroups,
  value,
  loading,
  hasAnyPreviewData,
  showEodBalance,
  variant,
  onSelectCard,
}: {
  dayGroups: PreviewDayGroup[]
  value: number | undefined
  loading: boolean
  hasAnyPreviewData: boolean
  showEodBalance: boolean
  variant: 'list' | 'table'
  onSelectCard: (card: CardPreviewGroup) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <PreviewBanner value={value} loading={loading} />
      {!loading && !hasAnyPreviewData && (
        <p className="text-sm text-muted text-center pt-8">Sem histórico suficiente para estimar este mês.</p>
      )}
      {hasAnyPreviewData &&
        (variant === 'list' ? (
          <PreviewDayList groups={dayGroups} showEodBalance={showEodBalance} onSelectCard={onSelectCard} />
        ) : (
          <PreviewDayTable groups={dayGroups} showEodBalance={showEodBalance} onSelectCard={onSelectCard} />
        ))}
    </div>
  )
}

function PreviewDayList({
  groups,
  showEodBalance,
  onSelectCard,
}: {
  groups: PreviewDayGroup[]
  showEodBalance: boolean
  onSelectCard: (card: CardPreviewGroup) => void
}) {
  if (groups.length === 0) {
    return <p className="text-sm text-muted text-center pt-8">Nenhuma transação encontrada.</p>
  }
  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <div key={group.dateKey} className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold tracking-wide text-muted">
            {formatDayHeader(group.dateKey)}
          </span>
          {group.transactions.map((tx) => (
            <TransactionRow key={tx.id} transaction={tx} />
          ))}
          {group.cards.map((card) => (
            <CardAggregateRow key={card.cardId} card={card} onClick={() => onSelectCard(card)} />
          ))}
          {showEodBalance && (
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-brand/5 border border-brand/25">
              <span className="text-xs text-brand-light">Saldo fim do dia</span>
              <span
                className={`text-xs font-semibold ${
                  group.endOfDayBalance >= 0 ? 'text-positive' : 'text-negative'
                }`}
              >
                {formatSignedCurrency(group.endOfDayBalance)}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function PreviewDayTable({
  groups,
  showEodBalance,
  onSelectCard,
}: {
  groups: PreviewDayGroup[]
  showEodBalance: boolean
  onSelectCard: (card: CardPreviewGroup) => void
}) {
  if (groups.length === 0) {
    return <p className="text-sm text-muted text-center py-8">Nenhuma transação encontrada.</p>
  }
  return (
    <div className="flex flex-col">
      <div className="flex items-center h-11 px-4 bg-surface text-xs font-semibold text-muted">
        <span className="flex-1">Transação</span>
        <span className="w-32">Categoria</span>
        <span className="w-32 text-right">Valor</span>
        <span className="w-16 text-center">Status</span>
      </div>
      {groups.map((group) => (
        <div key={group.dateKey}>
          <div className="flex items-center h-9 px-4 bg-bg text-[11px] font-semibold text-muted tracking-wide">
            {formatDayHeader(group.dateKey)}
          </div>
          {group.transactions.map((tx) => (
            <TransactionTableRow key={tx.id} transaction={tx} />
          ))}
          {group.cards.map((card) => (
            <CardAggregateTableRow key={card.cardId} card={card} onClick={() => onSelectCard(card)} />
          ))}
          {showEodBalance && (
            <div className="flex items-center justify-between h-9 px-4 bg-brand/5 border-y border-brand/25">
              <span className="text-xs text-brand-light">Saldo fim do dia</span>
              <span
                className={`text-xs font-semibold ${
                  group.endOfDayBalance >= 0 ? 'text-positive' : 'text-negative'
                }`}
              >
                {formatSignedCurrency(group.endOfDayBalance)}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// One collapsed row per card due that day — its full per-category breakdown (installments, fixed
// charges, category averages) opens in CardPreviewModal instead of being spelled out inline, so a
// month with several cards doesn't drown the account's own day-by-day forecast.
function CardAggregateRow({ card, onClick }: { card: CardPreviewGroup; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 h-[68px] px-3 rounded-xl bg-card border border-dashed border-border text-left"
    >
      <IconCircle background="#8B8FA820" size={40}>
        <CreditCard size={18} className="text-muted" />
      </IconCircle>
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className="text-sm font-semibold truncate">Cartão · {card.cardName}</span>
        <span className="text-xs text-muted truncate">Toque para ver por categoria</span>
      </div>
      <span className={`text-sm font-semibold ${card.value >= 0 ? 'text-positive' : 'text-negative'}`}>
        {formatSignedCurrency(card.value)}
      </span>
      <ChevronRight size={16} className="text-muted shrink-0" />
    </button>
  )
}

function CardAggregateTableRow({ card, onClick }: { card: CardPreviewGroup; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center h-14 px-4 border-b border-dashed border-border text-left"
    >
      <div className="flex-1 flex items-center gap-3 min-w-0">
        <IconCircle background="#8B8FA820" size={32}>
          <CreditCard size={15} className="text-muted" />
        </IconCircle>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-semibold truncate">Cartão · {card.cardName}</span>
          <span className="text-xs text-muted truncate">Ver por categoria</span>
        </div>
      </div>
      <span className="w-32 text-sm text-muted truncate">—</span>
      <span
        className={`w-32 text-right text-sm font-semibold ${card.value >= 0 ? 'text-positive' : 'text-negative'}`}
      >
        {formatSignedCurrency(card.value)}
      </span>
      <span className="w-16 flex items-center justify-center">
        <ChevronRight size={14} className="text-muted" />
      </span>
    </button>
  )
}

// The card's own preview grouped by source (Parcelas/Fixos/Média) — what CardPreviewSection used
// to render inline before it got collapsed into CardAggregateRow — now shown on demand instead of
// always taking up space in the account's day-by-day list.
function CardPreviewModal({ card, onClose }: { card: CardPreviewGroup; onClose: () => void }) {
  const groups = useMemo(() => groupPreviewTransactions(card.transactions), [card.transactions])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md max-h-[85vh] rounded-2xl bg-card p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold">Cartão · {card.cardName}</h2>
          <button onClick={onClose} className="text-sm text-muted">
            Fechar
          </button>
        </div>
        <div className="flex items-center justify-between px-1 -mt-2">
          <span className="text-xs text-muted">Estimativa da fatura</span>
          <span className={`text-sm font-semibold ${card.value >= 0 ? 'text-positive' : 'text-negative'}`}>
            {formatSignedCurrency(card.value)}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col gap-2">
          {groups.map((group) => (
            <div key={group.source} className="flex flex-col gap-2">
              <PreviewGroupHeader label={group.label} subtotal={group.subtotal} />
              {group.items.map((tx) => (
                <TransactionRow key={tx.id} transaction={tx} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const EMPTY_FIXED_FORM: FixedTransactionInput = {
  description: '',
  value: 0,
  accountId: '',
  categoryId: null,
  startDate: '',
  endDate: null,
}

function todayDateInputValue(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function FixedTransactionsModal({ onClose }: { onClose: () => void }) {
  const { data: fixedTransactions, isLoading } = useFixedTransactions()
  const { data: accounts } = useAccounts()
  const { data: categories } = useCategories()
  const createFixed = useCreateFixedTransaction()
  const updateFixed = useUpdateFixedTransaction()
  const deleteFixed = useDeleteFixedTransaction()

  const [editing, setEditing] = useState<FixedTransactionResponse | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<FixedTransactionResponse | null>(null)

  const flatCategories = categories ? flattenCategories(categories) : []

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(item: FixedTransactionResponse) {
    setEditing(item)
    setFormOpen(true)
  }

  function handleSubmit(input: FixedTransactionInput) {
    if (editing) {
      updateFixed.mutate(
        { id: editing.id, input },
        {
          onSuccess: () => {
            useToastStore.getState().show('Fixo atualizado.')
            setFormOpen(false)
          },
          onError: (error) => useToastStore.getState().show(error instanceof Error ? error.message : 'Falha ao salvar fixo.'),
        },
      )
    } else {
      createFixed.mutate(input, {
        onSuccess: () => {
          useToastStore.getState().show('Fixo criado.')
          setFormOpen(false)
        },
        onError: (error) => useToastStore.getState().show(error instanceof Error ? error.message : 'Falha ao salvar fixo.'),
      })
    }
  }

  function handleDelete() {
    if (!pendingDelete) return
    deleteFixed.mutate(pendingDelete.id, {
      onSuccess: () => {
        useToastStore.getState().show('Fixo removido.')
        setPendingDelete(null)
      },
      onError: (error) => useToastStore.getState().show(error instanceof Error ? error.message : 'Falha ao remover fixo.'),
    })
  }

  const pending = createFixed.isPending || updateFixed.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md max-h-[85vh] rounded-2xl bg-card p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold">Transações fixas</h2>
          <button onClick={onClose} className="text-sm text-muted">
            Fechar
          </button>
        </div>
        <p className="text-xs text-muted -mt-2">
          Lançamentos recorrentes (salário, aluguel, assinaturas) usados para estimar meses futuros sem
          transações.
        </p>

        <button
          onClick={openCreate}
          className="flex items-center justify-center gap-2 h-10 rounded-[10px] bg-brand text-sm font-semibold"
        >
          <Plus size={16} /> Novo fixo
        </button>

        <div className="flex-1 overflow-y-auto flex flex-col gap-2">
          {isLoading && <p className="text-sm text-muted text-center pt-4">Carregando...</p>}
          {!isLoading && fixedTransactions?.length === 0 && (
            <p className="text-sm text-muted text-center pt-4">Nenhum fixo cadastrado.</p>
          )}
          {fixedTransactions?.map((item) => (
            <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface">
              <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className="text-sm font-semibold truncate">{item.description}</span>
                <span className="text-xs text-muted truncate">
                  {item.accountName}
                  {item.categoryName ? ` · ${item.categoryName}` : ''}
                  {item.endDate ? ` · até ${formatFullDate(item.endDate)}` : ''}
                </span>
              </div>
              <span className={`text-sm font-semibold ${item.value >= 0 ? 'text-positive' : 'text-negative'}`}>
                {formatSignedCurrency(item.value)}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => openEdit(item)}
                  aria-label={`Editar ${item.description}`}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-muted bg-card"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => setPendingDelete(item)}
                  aria-label={`Remover ${item.description}`}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-negative bg-card"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {formOpen && (
        <FixedTransactionFormModal
          initial={
            editing
              ? {
                  description: editing.description,
                  value: editing.value,
                  accountId: editing.accountId,
                  categoryId: editing.categoryId,
                  startDate: editing.startDate.slice(0, 10),
                  endDate: editing.endDate ? editing.endDate.slice(0, 10) : null,
                }
              : { ...EMPTY_FIXED_FORM, accountId: accounts?.[0]?.id ?? '', startDate: todayDateInputValue() }
          }
          title={editing ? 'Editar fixo' : 'Novo fixo'}
          pending={pending}
          accounts={accounts ?? []}
          categories={flatCategories}
          onCancel={() => setFormOpen(false)}
          onSubmit={handleSubmit}
        />
      )}

      {pendingDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-card p-5 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <h2 className="text-base font-bold">Remover fixo</h2>
              <p className="text-sm text-muted">
                Isso vai remover <span className="font-semibold text-white">{pendingDelete.description}</span> dos
                fixos e das próximas estimativas.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setPendingDelete(null)}
                disabled={deleteFixed.isPending}
                className="h-9 px-4 rounded-lg text-sm font-semibold text-muted disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteFixed.isPending}
                className="h-9 px-4 rounded-lg text-sm font-semibold bg-negative disabled:opacity-60"
              >
                {deleteFixed.isPending ? 'Removendo...' : 'Remover'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FixedTransactionFormModal({
  initial,
  title,
  pending,
  accounts,
  categories,
  onCancel,
  onSubmit,
}: {
  initial: FixedTransactionInput
  title: string
  pending: boolean
  accounts: { id: string; name: string }[]
  categories: { id: string; name: string }[]
  onCancel: () => void
  onSubmit: (input: FixedTransactionInput) => void
}) {
  const [description, setDescription] = useState(initial.description)
  const [value, setValue] = useState(String(initial.value))
  const [accountId, setAccountId] = useState(initial.accountId)
  const [categoryId, setCategoryId] = useState(initial.categoryId ?? '')
  const [startDate, setStartDate] = useState(initial.startDate)
  const [endDate, setEndDate] = useState(initial.endDate ?? '')

  const valid = description.trim().length > 0 && accountId.length > 0 && startDate.length > 0

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    onSubmit({
      description: description.trim(),
      value: Number(value.replace(',', '.')) || 0,
      accountId,
      categoryId: categoryId || null,
      startDate: `${startDate}T00:00:00`,
      endDate: endDate ? `${endDate}T00:00:00` : null,
    })
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-2xl bg-card p-5 flex flex-col gap-4">
        <h2 className="text-base font-bold">{title}</h2>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Descrição</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            autoFocus
            className="h-10 px-3 rounded-lg bg-surface border border-border text-sm outline-none"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Valor (negativo para despesa)</span>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            inputMode="decimal"
            className="h-10 px-3 rounded-lg bg-surface border border-border text-sm outline-none"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Conta</span>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="h-10 px-3 rounded-lg bg-surface border border-border text-sm outline-none"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Categoria</span>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="h-10 px-3 rounded-lg bg-surface border border-border text-sm outline-none"
          >
            <option value="">Sem categoria</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">A partir de</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-10 px-3 rounded-lg bg-surface border border-border text-sm outline-none"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Até (opcional — deixe vazio se não tem fim)</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-10 px-3 rounded-lg bg-surface border border-border text-sm outline-none"
          />
        </label>

        <div className="flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="h-9 px-4 rounded-lg text-sm font-semibold text-muted disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={pending || !valid}
            className="h-9 px-4 rounded-lg text-sm font-semibold bg-brand disabled:opacity-60"
          >
            {pending ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  )
}

function flattenCategories(
  categories: CategoryResponse[],
): { id: string; name: string; icon: string; color: string }[] {
  const result: { id: string; name: string; icon: string; color: string }[] = []
  for (const c of categories) {
    result.push({ id: c.id, name: c.name, icon: c.icon, color: c.color })
    for (const child of c.children)
      result.push({ id: child.id, name: `${c.name} / ${child.name}`, icon: child.icon, color: child.color })
  }
  return result
}

const EMPTY_TX_FORM: TransactionInput = {
  description: '',
  value: 0,
  accountId: '',
  categoryId: null,
  dueDate: '',
  paidOut: false,
}

function TransactionFormModal({
  initial,
  title,
  isEditing,
  pending,
  accounts,
  categories,
  onCancel,
  onSubmit,
  onDelete,
}: {
  initial: TransactionInput
  title: string
  isEditing: boolean
  pending: boolean
  accounts: { id: string; name: string }[]
  categories: { id: string; name: string }[]
  onCancel: () => void
  onSubmit: (input: TransactionInput) => void
  onDelete?: () => void
}) {
  const [description, setDescription] = useState(initial.description)
  const [value, setValue] = useState(String(initial.value))
  const [accountId, setAccountId] = useState(initial.accountId)
  const [categoryId, setCategoryId] = useState(initial.categoryId ?? '')
  const [dueDate, setDueDate] = useState(initial.dueDate)
  const [paidOut, setPaidOut] = useState(initial.paidOut)

  const valid = description.trim().length > 0 && accountId.length > 0 && dueDate.length > 0

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    onSubmit({
      description: description.trim(),
      value: Number(value.replace(',', '.')) || 0,
      accountId,
      categoryId: categoryId || null,
      dueDate,
      paidOut,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-2xl bg-card p-5 flex flex-col gap-4"
      >
        <h2 className="text-base font-bold">{title}</h2>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Descrição</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            autoFocus
            className="h-10 px-3 rounded-lg bg-surface border border-border text-sm outline-none"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Valor (negativo para despesa)</span>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            inputMode="decimal"
            className="h-10 px-3 rounded-lg bg-surface border border-border text-sm outline-none"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Data</span>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="h-10 px-3 rounded-lg bg-surface border border-border text-sm outline-none"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Conta</span>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="h-10 px-3 rounded-lg bg-surface border border-border text-sm outline-none"
          >
            <option value="" disabled>
              Selecione
            </option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Categoria</span>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="h-10 px-3 rounded-lg bg-surface border border-border text-sm outline-none"
          >
            <option value="">Sem categoria</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center justify-between">
          <span className="text-xs text-muted">Pago</span>
          <Toggle checked={paidOut} onChange={setPaidOut} />
        </label>

        <div className="flex items-center justify-between gap-2.5">
          {isEditing && onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              disabled={pending}
              className="h-9 px-3 rounded-lg text-sm font-semibold text-negative disabled:opacity-60"
            >
              Remover
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onCancel}
              disabled={pending}
              className="h-9 px-4 rounded-lg text-sm font-semibold text-muted disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending || !valid}
              className="h-9 px-4 rounded-lg text-sm font-semibold bg-brand disabled:opacity-60"
            >
              {pending ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

function ConfirmDeleteTransactionModal({
  transaction,
  pending,
  onCancel,
  onConfirm,
}: {
  transaction: TransactionContract
  pending: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-card p-5 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-base font-bold">Remover transação</h2>
          <p className="text-sm text-muted">
            Isso vai remover <span className="font-semibold text-white">{transaction.description}</span>{' '}
            definitivamente.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2.5">
          <button
            onClick={onCancel}
            disabled={pending}
            className="h-9 px-4 rounded-lg text-sm font-semibold text-muted disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={pending}
            className="h-9 px-4 rounded-lg text-sm font-semibold bg-negative disabled:opacity-60"
          >
            {pending ? 'Removendo...' : 'Remover'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Lighter than the full edit form — a tap-to-select list of categories opened straight from the
// row icon, for the common case of just fixing a wrong/missing category.
function CategoryQuickEditModal({
  transaction,
  onClose,
}: {
  transaction: TransactionContract
  onClose: () => void
}) {
  const { data: categories } = useCategories()
  const updateCategory = useUpdateTransactionCategory()
  const flatCategories = categories ? flattenCategories(categories) : []
  const NoCategoryIcon = resolveCategoryIcon(null)

  function handleSelect(categoryId: string | null) {
    updateCategory.mutate(
      { id: transaction.id, categoryId },
      {
        onSuccess: () => {
          useToastStore.getState().show('Categoria atualizada.')
          onClose()
        },
        onError: (error) =>
          useToastStore.getState().show(error instanceof Error ? error.message : 'Falha ao trocar categoria.'),
      },
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm max-h-[80vh] rounded-2xl bg-card p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold">Trocar categoria</h2>
          <button onClick={onClose} className="text-sm text-muted">
            Fechar
          </button>
        </div>
        <p className="text-xs text-muted -mt-1 truncate">{transaction.description}</p>

        <div className="flex-1 overflow-y-auto flex flex-col gap-1">
          <button
            onClick={() => handleSelect(null)}
            disabled={updateCategory.isPending}
            className={`flex items-center gap-3 h-12 px-3 rounded-xl text-left disabled:opacity-60 ${
              !transaction.categoryId ? 'bg-brand/10 border border-brand/40' : 'bg-surface'
            }`}
          >
            <IconCircle background="#8B8FA820" size={32}>
              <NoCategoryIcon size={15} className="text-muted" />
            </IconCircle>
            <span className="text-sm font-medium">Sem categoria</span>
          </button>
          {flatCategories.map((c) => {
            const CatIcon = resolveCategoryIcon(c.icon)
            const active = c.id === transaction.categoryId
            const color = c.color || '#8B8FA8'
            return (
              <button
                key={c.id}
                onClick={() => handleSelect(c.id)}
                disabled={updateCategory.isPending}
                className={`flex items-center gap-3 h-12 px-3 rounded-xl text-left disabled:opacity-60 ${
                  active ? 'bg-brand/10 border border-brand/40' : 'bg-surface'
                }`}
              >
                <IconCircle background={`${color}20`} size={32}>
                  <CatIcon size={15} style={{ color }} />
                </IconCircle>
                <span className="text-sm font-medium truncate">{c.name}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
