import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, CircleCheck, X } from 'lucide-react'
import { useInvoice, invoiceQueryKey } from '../hooks/useInvoice'
import { useInvoicePreview } from '../hooks/useInvoicePreview'
import { payInvoice } from '../api/cards'
import { IconCircle } from '../components/ui/IconCircle'
import { CategoryBreakdownChart } from '../components/CategoryBreakdownChart'
import { buildCategoryBreakdown } from '../utils/categoryBreakdown'
import { formatCurrency, formatSignedCurrency } from '../utils/currency'
import { formatFullDate, formatMonthAbbr, formatMonthYear, formatShortDate } from '../utils/date'
import { resolveCategoryIcon } from '../utils/categoryIcon'
import { groupPreviewTransactions, previewSourceLabel } from '../utils/previewGroups'
import type { TransactionContract } from '../api/types'
import type { CategorySlice } from '../utils/categoryBreakdown'

export function CardInvoicePage() {
  const { cardId } = useParams<{ cardId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())

  const { data: invoice, isLoading, isError } = useInvoice(cardId, year, month)

  const sortedTransactions = useMemo(() => {
    if (!invoice) return []
    return [...invoice.transactions].sort(
      (a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime(),
    )
  }, [invoice])

  const isEmptyInvoice = sortedTransactions.length === 0
  const { data: preview, isLoading: isPreviewLoading } = useInvoicePreview(cardId, year, month, {
    enabled: isEmptyInvoice,
  })
  const previewGroups = useMemo(() => groupPreviewTransactions(preview?.transactions ?? []), [preview])
  const previewTransactionCount = preview?.transactions.length ?? 0
  const chartTransactions = useMemo(
    () => (isEmptyInvoice ? (preview?.transactions ?? []) : sortedTransactions),
    [isEmptyInvoice, preview, sortedTransactions],
  )

  const slices = useMemo(() => buildCategoryBreakdown(chartTransactions), [chartTransactions])
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())

  useEffect(() => {
    setSelectedKeys(new Set())
  }, [cardId, month, year])

  function toggleCategory(key: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const activeCategoryNames = useMemo(() => {
    if (selectedKeys.size === 0) return null
    const names = new Set<string>()
    for (const slice of slices) {
      if (selectedKeys.has(slice.key)) slice.categoryNames.forEach((name) => names.add(name))
    }
    return names
  }, [slices, selectedKeys])

  const displayedTransactions = useMemo(() => {
    if (!activeCategoryNames) return sortedTransactions
    return sortedTransactions.filter((tx) => activeCategoryNames.has(tx.categoryName || 'Sem categoria'))
  }, [sortedTransactions, activeCategoryNames])

  const displayedPreviewGroups = useMemo(() => {
    if (!activeCategoryNames) return previewGroups
    return previewGroups
      .map((group) => {
        const items = group.items.filter((tx) => activeCategoryNames.has(tx.categoryName || 'Sem categoria'))
        return { ...group, items, subtotal: items.reduce((sum, tx) => sum + tx.value, 0) }
      })
      .filter((group) => group.items.length > 0)
  }, [previewGroups, activeCategoryNames])

  const payMutation = useMutation({
    mutationFn: (status: boolean) => payInvoice(invoice!.invoiceId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoiceQueryKey(cardId ?? '', year, month) })
      queryClient.invalidateQueries({ queryKey: ['cards'] })
    },
  })

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
  if (isError) return <CenteredMessage text="Não foi possível carregar a fatura." />
  if (!invoice) return <CenteredMessage text="Sem fatura para este mês." />

  return (
    <div>
      {/* Mobile */}
      <div className="lg:hidden flex flex-col h-dvh">
        <div className="flex items-center gap-2.5 px-4 py-3">
          <button onClick={() => navigate('/cartoes')}>
            <ChevronLeft size={22} />
          </button>
          <span className="flex-1 min-w-0 truncate text-base font-bold">{invoice.name}</span>
          <div className="flex items-center gap-1.5 text-muted">
            <button onClick={goToPreviousMonth}>
              <ChevronLeft size={16} />
            </button>
            <span className="text-[13px]">{formatMonthAbbr(month)}</span>
            <button onClick={goToNextMonth}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 p-4 bg-card border-b border-border">
          <StatRow label="Total da Fatura" value={formatCurrency(Math.abs(invoice.value))} tone="negative" />
          <StatRow label="Vencimento" value={formatFullDate(invoice.dueDate)} tone="white" />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">Status</span>
            <StatusPill payment={invoice.payment} />
          </div>
          <PayButton
            payment={invoice.payment}
            pending={payMutation.isPending}
            onPay={() => payMutation.mutate(!invoice.payment)}
            className="h-10 rounded-[10px] text-sm"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-4 pt-3 pb-6 flex flex-col gap-2">
          {chartTransactions.length > 0 && (
            <div className="p-3 rounded-xl bg-card">
              <CategoryBreakdownChart slices={slices} selectedKeys={selectedKeys} onToggle={toggleCategory} />
            </div>
          )}
          <FilterChips
            slices={slices}
            selectedKeys={selectedKeys}
            onToggle={toggleCategory}
            onClear={() => setSelectedKeys(new Set())}
          />
          {isEmptyInvoice && <PreviewBanner value={preview?.value} loading={isPreviewLoading} />}
          {isEmptyInvoice && !isPreviewLoading && previewTransactionCount === 0 && (
            <p className="text-sm text-muted text-center pt-4">
              Sem histórico suficiente para estimar esta fatura.
            </p>
          )}
          {activeCategoryNames && (isEmptyInvoice ? displayedPreviewGroups : displayedTransactions).length === 0 && (
            <p className="text-sm text-muted text-center pt-4">Nenhuma transação para os filtros selecionados.</p>
          )}
          {isEmptyInvoice
            ? displayedPreviewGroups.map((group) => (
                <div key={group.source} className="flex flex-col gap-2">
                  <PreviewGroupHeader label={group.label} subtotal={group.subtotal} />
                  {group.items.map((tx) => (
                    <StatementRow key={tx.id} transaction={tx} />
                  ))}
                </div>
              ))
            : displayedTransactions.map((tx) => <StatementRow key={tx.id} transaction={tx} />)}
        </div>
      </div>

      {/* Desktop */}
      <div className="hidden lg:flex flex-col gap-5 p-8 h-dvh">
        <span className="text-[13px] text-muted">Cartões&nbsp;&nbsp;/&nbsp;&nbsp;{invoice.name}</span>

        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold">{invoice.name}</h1>
            <div className="flex items-center gap-2.5 text-sm text-muted">
              <button onClick={goToPreviousMonth}>
                <ChevronLeft size={18} />
              </button>
              <span>{formatMonthYear(month, year)}</span>
              <button onClick={goToNextMonth}>
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
          <PayButton
            payment={invoice.payment}
            pending={payMutation.isPending}
            onPay={() => payMutation.mutate(!invoice.payment)}
            className="h-10 px-5 rounded-[10px] text-sm"
          />
        </div>

        {chartTransactions.length > 0 ? (
          <div className="grid grid-cols-2 rounded-xl bg-surface border border-border overflow-hidden">
            <div className="grid grid-cols-2">
              <StatCell
                label="Total da Fatura"
                value={formatCurrency(Math.abs(invoice.value))}
                tone="negative"
                borderRight
                borderBottom
              />
              <StatCell label="Vencimento" value={formatFullDate(invoice.dueDate)} tone="white" borderBottom />
              <StatCell label="Lançamentos" value={`${sortedTransactions.length} itens`} tone="white" borderRight />
              <div className="flex flex-col gap-1.5 px-5 py-4">
                <span className="text-xs text-muted">Status</span>
                <StatusPill payment={invoice.payment} />
              </div>
            </div>
            <div className="flex flex-col items-center gap-2 justify-center px-5 py-4 border-l border-border">
              <span className="self-start text-xs text-muted uppercase tracking-wide">Por categoria</span>
              <CategoryBreakdownChart slices={slices} selectedKeys={selectedKeys} onToggle={toggleCategory} />
            </div>
          </div>
        ) : (
          <div className="flex rounded-xl bg-surface border border-border">
            <StatCell
              label="Total da Fatura"
              value={formatCurrency(Math.abs(invoice.value))}
              tone="negative"
              borderRight
              grow
            />
            <StatCell label="Vencimento" value={formatFullDate(invoice.dueDate)} tone="white" borderRight grow />
            <StatCell
              label="Lançamentos"
              value={`${sortedTransactions.length} itens`}
              tone="white"
              borderRight
              grow
            />
            <div className="flex-1 flex flex-col gap-1.5 px-5 py-4">
              <span className="text-xs text-muted">Status</span>
              <StatusPill payment={invoice.payment} />
            </div>
          </div>
        )}

        <FilterChips
          slices={slices}
          selectedKeys={selectedKeys}
          onToggle={toggleCategory}
          onClear={() => setSelectedKeys(new Set())}
        />

        <div className="flex-1 min-h-0 flex flex-col rounded-xl bg-surface border border-border overflow-y-auto">
          <div className="flex items-center h-11 px-4 bg-card text-[11px] font-semibold text-muted tracking-wide">
            <span className="w-[90px]">DATA</span>
            <span className="flex-1">DESCRIÇÃO</span>
            <span className="w-[140px]">CARTÃO</span>
            <span className="w-[140px]">CATEGORIA</span>
            <span className="w-[120px] text-right">VALOR</span>
          </div>
          {isEmptyInvoice && <PreviewBanner value={preview?.value} loading={isPreviewLoading} />}
          {isEmptyInvoice && !isPreviewLoading && previewTransactionCount === 0 && (
            <p className="text-sm text-muted text-center py-8">
              Sem histórico suficiente para estimar esta fatura.
            </p>
          )}
          {activeCategoryNames && (isEmptyInvoice ? displayedPreviewGroups : displayedTransactions).length === 0 && (
            <p className="text-sm text-muted text-center py-8">Nenhuma transação para os filtros selecionados.</p>
          )}
          {isEmptyInvoice
            ? displayedPreviewGroups.map((group) => (
                <div key={group.source}>
                  <PreviewGroupHeader label={group.label} subtotal={group.subtotal} />
                  {group.items.map((tx) => (
                    <StatementTableRow key={tx.id} transaction={tx} />
                  ))}
                </div>
              ))
            : displayedTransactions.map((tx) => <StatementTableRow key={tx.id} transaction={tx} />)}
        </div>
      </div>
    </div>
  )
}

function PreviewBanner({ value, loading }: { value: number | undefined; loading: boolean }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-card border border-dashed border-border text-xs">
      <span className="text-muted">Estimativa — fatura ainda não importada</span>
      {!loading && value !== undefined && (
        <span className="font-semibold">{formatCurrency(Math.abs(value))}</span>
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

function FilterChips({
  slices,
  selectedKeys,
  onToggle,
  onClear,
}: {
  slices: CategorySlice[]
  selectedKeys: Set<string>
  onToggle: (key: string) => void
  onClear: () => void
}) {
  if (selectedKeys.size === 0) return null
  const selectedSlices = slices.filter((slice) => selectedKeys.has(slice.key))

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {selectedSlices.map((slice) => (
        <button
          key={slice.key}
          type="button"
          onClick={() => onToggle(slice.key)}
          className="flex items-center gap-1 h-6 pl-2 pr-1.5 rounded-full bg-card border border-border text-[11px] text-white"
        >
          <span className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: slice.color }} />
          {slice.label}
          <X size={11} className="text-muted" />
        </button>
      ))}
      <button type="button" onClick={onClear} className="text-[11px] text-muted underline underline-offset-2">
        Limpar filtro
      </button>
    </div>
  )
}

function CenteredMessage({ text }: { text: string }) {
  return <div className="flex items-center justify-center min-h-[60vh] text-sm text-muted">{text}</div>
}

function StatRow({ label, value, tone }: { label: string; value: string; tone: 'negative' | 'white' }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted">{label}</span>
      <span className={`text-sm font-bold ${tone === 'negative' ? 'text-negative' : 'text-white'}`}>{value}</span>
    </div>
  )
}

function StatCell({
  label,
  value,
  tone,
  borderRight,
  borderBottom,
  grow,
}: {
  label: string
  value: string
  tone: 'negative' | 'white'
  borderRight?: boolean
  borderBottom?: boolean
  grow?: boolean
}) {
  return (
    <div
      className={`flex flex-col gap-1.5 px-5 py-4 ${grow ? 'flex-1' : ''} ${
        borderRight ? 'border-r border-border' : ''
      } ${borderBottom ? 'border-b border-border' : ''}`}
    >
      <span className="text-xs text-muted">{label}</span>
      <span className={`text-lg font-bold ${tone === 'negative' ? 'text-negative' : 'text-white'}`}>{value}</span>
    </div>
  )
}

function StatusPill({ payment }: { payment: boolean }) {
  return (
    <span
      className={`w-fit h-[22px] flex items-center px-2.5 rounded-md text-[11px] font-semibold ${
        payment ? 'bg-positive/20 text-positive' : 'bg-negative/20 text-negative'
      }`}
    >
      {payment ? 'Pago' : 'A Pagar'}
    </span>
  )
}

function PayButton({
  payment,
  pending,
  onPay,
  className,
}: {
  payment: boolean
  pending: boolean
  onPay: () => void
  className: string
}) {
  if (payment) {
    return (
      <div className={`flex items-center justify-center gap-2 font-bold text-positive bg-positive/10 ${className}`}>
        <CircleCheck size={16} /> Fatura Paga
      </div>
    )
  }
  return (
    <button
      onClick={onPay}
      disabled={pending}
      className={`flex items-center justify-center gap-2 font-bold bg-brand disabled:opacity-60 ${className}`}
    >
      <CircleCheck size={16} /> {pending ? 'Processando...' : 'Pagar Fatura'}
    </button>
  )
}

function subCardLabel(transaction: TransactionContract): string | null {
  if (transaction.subCardHolderName) return transaction.subCardHolderName
  if (transaction.subCardLast4) return `•••• ${transaction.subCardLast4}`
  return null
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

function StatementRow({ transaction }: { transaction: TransactionContract }) {
  const Icon = resolveCategoryIcon(transaction.icon)
  const color = transaction.color || '#8B8FA8'
  const subCard = subCardLabel(transaction)
  return (
    <div className="flex items-center gap-3 h-[60px] px-3 rounded-xl bg-card">
      <IconCircle background={`${color}20`} size={36}>
        <Icon size={16} style={{ color }} />
      </IconCircle>
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm font-semibold truncate">{transaction.description}</span>
          <PreviewBadge source={transaction.previewSource} />
        </span>
        <span className="text-xs text-muted truncate">
          {formatShortDate(transaction.dueDate)}
          {subCard ? ` · ${subCard}` : ''}
        </span>
      </div>
      <span className={`text-sm font-semibold ${transaction.value >= 0 ? 'text-positive' : 'text-negative'}`}>
        {formatSignedCurrency(transaction.value)}
      </span>
    </div>
  )
}

function StatementTableRow({ transaction }: { transaction: TransactionContract }) {
  const subCard = subCardLabel(transaction)
  return (
    <div className="flex items-center h-[52px] px-4 border-b border-border">
      <span className="w-[90px] text-[13px] text-muted">{formatShortDate(transaction.dueDate)}</span>
      <span className="flex-1 flex items-center gap-1.5 min-w-0 text-sm font-medium truncate">
        <span className="truncate">{transaction.description}</span>
        <PreviewBadge source={transaction.previewSource} />
      </span>
      <span className="w-[140px] text-[13px] text-muted truncate">{subCard ?? '—'}</span>
      <span className="w-[140px] text-[13px] text-muted truncate">{transaction.categoryName}</span>
      <span
        className={`w-[120px] text-right text-sm font-semibold ${
          transaction.value >= 0 ? 'text-positive' : 'text-negative'
        }`}
      >
        {formatSignedCurrency(transaction.value)}
      </span>
    </div>
  )
}
