import { useMemo, type ReactNode } from 'react'
import { Bell, Settings, Plus, CirclePlus, CreditCard } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useHomeCashFlow } from '../hooks/useHomeCashFlow'
import { useTransactions } from '../hooks/useTransactions'
import { comingSoon } from '../store/toastStore'
import { Card } from '../components/ui/Card'
import { IconCircle } from '../components/ui/IconCircle'
import { formatCurrency, formatSignedCurrency } from '../utils/currency'
import { computeMonthSummary } from '../utils/monthSummary'
import { colorFromString } from '../utils/colorFromString'
import type { AccountResponse } from '../api/types'

export function HomePage() {
  const navigate = useNavigate()
  const { data: cashFlow, isLoading, isError } = useHomeCashFlow()

  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const { data: txData } = useTransactions(month, year)
  const monthSummary = useMemo(() => (txData ? computeMonthSummary(txData) : null), [txData])

  if (isLoading) return <CenteredMessage text="Carregando..." />
  if (isError || !cashFlow) return <CenteredMessage text="Não foi possível carregar seus dados." />

  return (
    <div>
      {/* Mobile */}
      <div className="lg:hidden">
        <header className="flex items-center justify-between h-14 px-4">
          <h1 className="text-[22px] font-bold">Início</h1>
          <div className="flex items-center gap-3 text-muted">
            <button onClick={() => navigate('/backup')}>
              <Settings size={22} />
            </button>
            <button onClick={comingSoon}>
              <Bell size={22} />
            </button>
          </div>
        </header>

        <div className="px-4 pt-2 pb-3">
          <div
            className="rounded-[20px] p-4 flex flex-col gap-2"
            style={{ background: 'linear-gradient(135deg, #9B7CFF, #5B3CCC)' }}
          >
            <span className="text-sm font-medium text-[#E0D4FF]">Olá 👋</span>
            <span className="text-[11px] text-white/70">Saldo Total</span>
            <span className="text-2xl font-bold">{formatSignedCurrency(cashFlow.total)}</span>
            <button
              onClick={comingSoon}
              className="self-start flex items-center gap-1.5 h-8 px-3.5 rounded-2xl bg-white/20 text-xs font-semibold"
            >
              <Plus size={13} /> Adicionar Transação
            </button>
          </div>
        </div>

        <Section title="Minhas Contas" addLabel="Adicionar Conta">
          {cashFlow.accounts.map((account) => (
            <AccountRow key={account.id} account={account} />
          ))}
        </Section>

        <Section title="Meus Cartões" addLabel="Adicionar Cartão">
          {cashFlow.cards.map((card) => (
            <CardRow key={card.id} card={card} />
          ))}
        </Section>
      </div>

      {/* Desktop */}
      <div className="hidden lg:flex flex-col gap-6 p-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">Início</h1>
          <p className="text-sm text-muted">Bom dia.</p>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <StatTile label="Saldo Total" display={formatCurrency(cashFlow.total)} tone="positive" />
          <StatTile
            label="Receitas"
            display={formatSignedCurrency(monthSummary?.totalRevenue ?? 0)}
            tone="positive"
          />
          <StatTile
            label="Despesas"
            display={formatSignedCurrency(-(monthSummary?.totalExpenses ?? 0))}
            tone="negative"
          />
          <StatTile
            label="Previsto fim do mês"
            display={formatCurrency(monthSummary?.projectedEndBalance ?? cashFlow.total)}
            tone="neutral"
          />
        </div>

        <div className="flex gap-6 items-start">
          <Card className="flex-1 flex flex-col gap-4 p-5">
            <h2 className="text-[15px] font-semibold">Minhas Contas</h2>
            <div className="flex flex-col gap-3">
              {cashFlow.accounts.map((account) => (
                <AccountRow key={account.id} account={account} />
              ))}
            </div>
            <AddLink label="Adicionar Conta" />
          </Card>

          <Card className="flex-1 flex flex-col gap-4 p-5">
            <h2 className="text-[15px] font-semibold">Meus Cartões</h2>
            <div className="flex flex-col gap-3">
              {cashFlow.cards.map((card) => (
                <CardRow key={card.id} card={card} />
              ))}
            </div>
            <AddLink label="Adicionar Cartão" />
          </Card>
        </div>

        <Card className="p-6 flex flex-col gap-4">
          <h2 className="text-[15px] font-semibold">Gastos por Categoria</h2>
          <CategoryBarChart labels={cashFlow.dashBoard?.labels ?? []} values={cashFlow.dashBoard?.value ?? []} />
        </Card>
      </div>
    </div>
  )
}

function CenteredMessage({ text }: { text: string }) {
  return <div className="flex items-center justify-center min-h-[60vh] text-sm text-muted">{text}</div>
}

function Section({ title, addLabel, children }: { title: string; addLabel: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 px-4 pt-2">
      <div className="h-9 flex items-center">
        <h2 className="text-base font-bold">{title}</h2>
      </div>
      <div className="flex flex-col gap-1.5">{children}</div>
      <AddLink label={addLabel} />
    </div>
  )
}

function AddLink({ label }: { label: string }) {
  return (
    <button
      onClick={comingSoon}
      className="flex items-center justify-center gap-1 h-9 text-xs font-medium text-brand"
    >
      <CirclePlus size={13} /> {label}
    </button>
  )
}

function AccountRow({ account }: { account: AccountResponse }) {
  const color = colorFromString(account.id)
  return (
    <div className="flex items-center justify-between h-12 px-3 rounded-xl bg-card border border-border">
      <div className="flex items-center gap-2.5">
        <IconCircle background={color} size={32}>
          <span className="text-sm font-bold">{account.name.charAt(0).toUpperCase()}</span>
        </IconCircle>
        <span className="text-sm font-semibold">{account.name}</span>
      </div>
      <span className={`text-sm font-semibold ${account.value >= 0 ? 'text-positive' : 'text-negative'}`}>
        {formatCurrency(account.value)}
      </span>
    </div>
  )
}

function CardRow({ card }: { card: AccountResponse }) {
  const color = colorFromString(card.id)
  return (
    <div className="flex items-center justify-between h-12 px-3 rounded-xl bg-card border border-border">
      <div className="flex items-center gap-2.5">
        <IconCircle background={color} size={32}>
          <CreditCard size={16} />
        </IconCircle>
        <span className="text-[13px] font-semibold">{card.name}</span>
      </div>
      <button
        onClick={comingSoon}
        className="h-[26px] px-2.5 rounded-full bg-surface text-[10px] font-medium text-muted"
      >
        ver faturas
      </button>
    </div>
  )
}

function StatTile({
  label,
  display,
  tone,
}: {
  label: string
  display: string
  tone: 'positive' | 'negative' | 'neutral'
}) {
  const color = tone === 'positive' ? 'text-positive' : tone === 'negative' ? 'text-negative' : 'text-white'
  return (
    <Card className="p-5 flex flex-col gap-3">
      <span className="text-sm text-muted">{label}</span>
      <span className={`text-xl font-bold ${color}`}>{display}</span>
    </Card>
  )
}

function CategoryBarChart({ labels, values }: { labels: string[]; values: number[] }) {
  if (labels.length === 0) return <p className="text-sm text-muted">Sem dados neste mês.</p>
  const max = Math.max(1, ...values)
  return (
    <div className="flex flex-col gap-3.5">
      {labels.map((label, i) => (
        <div key={label} className="flex items-center gap-3">
          <span className="w-32 shrink-0 text-sm text-muted truncate">{label}</span>
          <div className="flex-1 h-2.5 rounded-full bg-surface overflow-hidden">
            <div className="h-full rounded-full bg-brand" style={{ width: `${(values[i] / max) * 100}%` }} />
          </div>
          <span className="w-24 shrink-0 text-right text-sm font-semibold">{formatCurrency(values[i])}</span>
        </div>
      ))}
    </div>
  )
}
