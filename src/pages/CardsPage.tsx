import { useMemo, useRef, useState } from 'react'
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { CirclePlus, Plus, Upload } from 'lucide-react'
import { useCards } from '../hooks/useCards'
import { getInvoice, importItauFatura } from '../api/cards'
import { invoiceQueryKey } from '../hooks/useInvoice'
import { comingSoon, useToastStore } from '../store/toastStore'
import { colorFromString } from '../utils/colorFromString'
import { gradientFromString } from '../utils/cardGradient'
import { formatCurrency } from '../utils/currency'
import { readFileAsDataUrl } from '../utils/file'
import type { AccountResponse, ImportItauFaturaResponse, TransactionInvoiceResponse } from '../api/types'

export function CardsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: cards, isLoading, isError } = useCards()

  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  const invoiceQueries = useQueries({
    queries: (cards ?? []).map((card) => ({
      queryKey: invoiceQueryKey(card.id, year, month),
      queryFn: () => getInvoice(card.id, year, month),
      enabled: !!cards,
    })),
  })

  const invoiceByCardId = useMemo(() => {
    const map = new Map<string, TransactionInvoiceResponse | null>()
    ;(cards ?? []).forEach((card, i) => {
      map.set(card.id, invoiceQueries[i]?.data ?? null)
    })
    return map
  }, [cards, invoiceQueries])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingCard, setPendingCard] = useState<{ id: string; name: string } | null>(null)
  const [confirmImport, setConfirmImport] = useState<{ id: string; name: string; file: File } | null>(null)

  const importMutation = useMutation({
    mutationFn: async ({ accountId, file }: { accountId: string; file: File }) => {
      const dataUrl = await readFileAsDataUrl(file)
      return importItauFatura(accountId, dataUrl)
    },
    onSuccess: (response: ImportItauFaturaResponse, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cards'] })
      queryClient.invalidateQueries({ queryKey: ['invoice', variables.accountId] })
      useToastStore
        .getState()
        .show(
          `Fatura ${String(response.invoiceMonth).padStart(2, '0')}/${response.invoiceYear} importada: ${response.transactionsImported} lançamentos (${formatCurrency(Math.abs(response.totalValue))})`,
        )
      setConfirmImport(null)
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Falha ao importar a fatura.'
      useToastStore.getState().show(message)
      setConfirmImport(null)
    },
  })

  if (isLoading) return <CenteredMessage text="Carregando..." />
  if (isError || !cards) return <CenteredMessage text="Não foi possível carregar seus cartões." />

  function goToInvoice(cardId: string) {
    navigate(`/cartoes/${cardId}`)
  }

  function openImportPicker(cardId: string, cardName: string) {
    setPendingCard({ id: cardId, name: cardName })
    fileInputRef.current?.click()
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file && pendingCard) {
      setConfirmImport({ id: pendingCard.id, name: pendingCard.name, file })
    }
    setPendingCard(null)
  }

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleFileSelected}
      />

      {confirmImport && (
        <ImportConfirmModal
          cardName={confirmImport.name}
          pending={importMutation.isPending}
          onCancel={() => setConfirmImport(null)}
          onConfirm={() => importMutation.mutate({ accountId: confirmImport.id, file: confirmImport.file })}
        />
      )}

      {/* Mobile */}
      <div className="lg:hidden flex flex-col h-screen">
        <div className="flex items-center justify-between px-4 h-14">
          <h1 className="text-[22px] font-bold">Cartões</h1>
          <button onClick={comingSoon} className="text-brand">
            <CirclePlus size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 flex flex-col gap-4">
          {cards.length === 0 && <EmptyState />}
          {cards.map((card) => (
            <MobileCardItem
              key={card.id}
              card={card}
              invoice={invoiceByCardId.get(card.id) ?? null}
              onViewInvoice={() => goToInvoice(card.id)}
              onImportInvoice={() => openImportPicker(card.id, card.name)}
            />
          ))}
        </div>
      </div>

      {/* Desktop */}
      <div className="hidden lg:flex flex-col gap-6 p-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Cartões</h1>
          <button
            onClick={comingSoon}
            className="flex items-center gap-2 h-10 px-4 rounded-[10px] bg-brand text-sm font-semibold"
          >
            <Plus size={16} /> Adicionar Cartão
          </button>
        </div>

        {cards.length === 0 && <EmptyState />}

        <div className="flex flex-wrap gap-6">
          {cards.map((card) => (
            <DesktopCardItem
              key={card.id}
              card={card}
              invoice={invoiceByCardId.get(card.id) ?? null}
              onViewInvoice={() => goToInvoice(card.id)}
              onImportInvoice={() => openImportPicker(card.id, card.name)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function ImportConfirmModal({
  cardName,
  pending,
  onCancel,
  onConfirm,
}: {
  cardName: string
  pending: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-card p-5 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-base font-bold">Importar fatura Itaú</h2>
          <p className="text-sm text-muted">
            Isso vai apagar todos os lançamentos já importados da fatura do mês encontrado no arquivo para{' '}
            <span className="font-semibold text-white">{cardName}</span> e substituí-los pelo conteúdo do xlsx.
            Essa ação não pode ser desfeita.
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
            className="h-9 px-4 rounded-lg text-sm font-semibold bg-brand disabled:opacity-60"
          >
            {pending ? 'Importando...' : 'Importar e substituir'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CenteredMessage({ text }: { text: string }) {
  return <div className="flex items-center justify-center min-h-[60vh] text-sm text-muted">{text}</div>
}

function EmptyState() {
  return <p className="text-sm text-muted text-center pt-8">Nenhum cartão cadastrado.</p>
}

function CardTop({
  card,
  gradient,
  height,
  numberFontSize,
  masked,
}: {
  card: AccountResponse
  gradient: [string, string]
  height: number
  numberFontSize: number
  masked: string
}) {
  return (
    <div
      className="flex flex-col justify-between rounded-t-2xl p-3.5"
      style={{ height, background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})` }}
    >
      <span className="text-[10px] font-bold tracking-[1.5px]">{card.name.toUpperCase()}</span>
      <span className="tracking-[2px]" style={{ fontSize: numberFontSize }}>
        {masked}
      </span>
    </div>
  )
}

function MobileCardItem({
  card,
  invoice,
  onViewInvoice,
  onImportInvoice,
}: {
  card: AccountResponse
  invoice: TransactionInvoiceResponse | null
  onViewInvoice: () => void
  onImportInvoice: () => void
}) {
  const accent = colorFromString(card.id)
  const gradient = gradientFromString(card.id)
  const last4 = card.subCards[0]?.last4 ?? '••••'

  return (
    <div className="rounded-2xl bg-card overflow-hidden">
      <CardTop card={card} gradient={gradient} height={120} numberFontSize={13} masked={`•••• ${last4}`} />
      <div className="flex items-center justify-between p-3.5">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-bold">{card.name}</span>
          <span className="text-xs text-negative">
            {invoice ? `Fatura: ${formatCurrency(Math.abs(invoice.value))}` : 'Sem fatura'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onImportInvoice}
            title="Importar fatura Itaú (xlsx)"
            className="h-[34px] w-[34px] flex items-center justify-center rounded-lg text-muted bg-surface"
          >
            <Upload size={16} />
          </button>
          <button
            onClick={onViewInvoice}
            className="h-[34px] px-3.5 rounded-lg text-xs font-semibold"
            style={{ background: `${accent}20`, color: accent }}
          >
            Ver fatura
          </button>
        </div>
      </div>
    </div>
  )
}

function DesktopCardItem({
  card,
  invoice,
  onViewInvoice,
  onImportInvoice,
}: {
  card: AccountResponse
  invoice: TransactionInvoiceResponse | null
  onViewInvoice: () => void
  onImportInvoice: () => void
}) {
  const accent = colorFromString(card.id)
  const gradient = gradientFromString(card.id)
  const last4 = card.subCards[0]?.last4 ?? '••••'

  return (
    <div className="w-[300px] rounded-2xl bg-card overflow-hidden">
      <CardTop
        card={card}
        gradient={gradient}
        height={150}
        numberFontSize={14}
        masked={`•••• •••• •••• ${last4}`}
      />
      <div className="flex flex-col gap-2.5 p-3.5">
        <span className="text-[15px] font-bold">{card.name}</span>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">Fatura atual</span>
          <span className="text-[13px] font-bold text-negative">
            {invoice ? formatCurrency(Math.abs(invoice.value)) : '—'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onImportInvoice}
            title="Importar fatura Itaú (xlsx)"
            className="h-9 w-9 flex items-center justify-center rounded-lg text-muted bg-surface"
          >
            <Upload size={16} />
          </button>
          <button
            onClick={onViewInvoice}
            className="flex-1 h-9 rounded-lg text-[13px] font-semibold"
            style={{ background: `${accent}20`, color: accent }}
          >
            Ver fatura
          </button>
        </div>
      </div>
    </div>
  )
}
