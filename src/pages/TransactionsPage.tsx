import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, Plus } from 'lucide-react'
import { useTransactions } from '../hooks/useTransactions'
import { useHomeCashFlow } from '../hooks/useHomeCashFlow'
import { comingSoon } from '../store/toastStore'
import { Card } from '../components/ui/Card'
import { IconCircle } from '../components/ui/IconCircle'
import { Toggle } from '../components/ui/Toggle'
import { formatCurrency, formatSignedCurrency } from '../utils/currency'
import { formatDayHeader, formatMonthYear } from '../utils/date'
import { computeMonthSummary, type DayGroup } from '../utils/monthSummary'
import { resolveCategoryIcon } from '../utils/categoryIcon'
import type { TransactionContract } from '../api/types'

export function TransactionsPage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [query, setQuery] = useState('')
  const [showEodBalance, setShowEodBalance] = useState(true)

  const { data: txData, isLoading, isError } = useTransactions(month, year)
  const { data: cashFlow } = useHomeCashFlow()

  const monthSummary = useMemo(() => (txData ? computeMonthSummary(txData) : null), [txData])

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
          <TransactionGroups groups={filteredGroups} showEodBalance={showEodBalance} />
        </div>

        <div className="fixed bottom-24 left-0 right-0 flex items-center justify-between px-5 h-[72px] bg-surface border-t border-border">
          <div className="flex flex-col">
            <span className="text-xs text-muted">Saldo atual</span>
            <span className="text-base font-bold text-positive">{formatCurrency(cashFlow?.total ?? 0)}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-xs text-muted">Previsto fim do mês</span>
            <span className="text-base font-bold text-positive">
              {formatCurrency(monthSummary.projectedEndBalance)}
            </span>
          </div>
        </div>

        <button
          onClick={comingSoon}
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
            <div className="flex items-center gap-2 text-sm text-muted">
              <span>Saldo fim do dia</span>
              <Toggle checked={showEodBalance} onChange={setShowEodBalance} />
            </div>
            <button
              onClick={comingSoon}
              className="flex items-center gap-2 h-10 px-4 rounded-[10px] bg-brand text-sm font-semibold"
            >
              <Plus size={16} /> Nova Transação
            </button>
          </div>
        </div>

        <div className="flex-1 flex gap-5 min-h-0">
          <Card className="flex-1 overflow-y-auto">
            <TransactionTable groups={filteredGroups} showEodBalance={showEodBalance} />
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
                display={formatCurrency(monthSummary.projectedEndBalance)}
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

function TransactionGroups({ groups, showEodBalance }: { groups: DayGroup[]; showEodBalance: boolean }) {
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

function TransactionRow({ transaction }: { transaction: TransactionContract }) {
  const Icon = resolveCategoryIcon(transaction.icon)
  const value = transaction.value
  const color = transaction.color || '#8B8FA8'

  return (
    <div className="flex items-center gap-3 h-[68px] px-3 rounded-xl bg-card">
      <IconCircle background={`${color}20`} size={40}>
        <Icon size={18} style={{ color }} />
      </IconCircle>
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className="text-sm font-semibold truncate">{transaction.description}</span>
        <span className="text-xs text-muted truncate">{transaction.categoryName}</span>
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <span className={`text-sm font-semibold ${value >= 0 ? 'text-positive' : 'text-negative'}`}>
          {formatSignedCurrency(value)}
        </span>
        <span
          className={`w-[9px] h-[9px] rounded-full ${
            transaction.paidOut ? 'bg-positive' : 'border border-muted'
          }`}
        />
      </div>
    </div>
  )
}

function TransactionTable({ groups, showEodBalance }: { groups: DayGroup[]; showEodBalance: boolean }) {
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

function TransactionTableRow({ transaction }: { transaction: TransactionContract }) {
  const Icon = resolveCategoryIcon(transaction.icon)
  const value = transaction.value
  const color = transaction.color || '#8B8FA8'

  return (
    <div className="flex items-center h-14 px-4 border-b border-border">
      <div className="flex-1 flex items-center gap-3 min-w-0">
        <IconCircle background={`${color}20`} size={32}>
          <Icon size={15} style={{ color }} />
        </IconCircle>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-semibold truncate">{transaction.description}</span>
          <span className="text-xs text-muted truncate">{transaction.account}</span>
        </div>
      </div>
      <span className="w-32 text-sm text-muted truncate">{transaction.categoryName}</span>
      <span className={`w-32 text-right text-sm font-semibold ${value >= 0 ? 'text-positive' : 'text-negative'}`}>
        {formatSignedCurrency(value)}
      </span>
      <span className="w-16 flex items-center justify-center">
        <span
          className={`w-[9px] h-[9px] rounded-full ${
            transaction.paidOut ? 'bg-positive' : 'border border-muted'
          }`}
        />
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
