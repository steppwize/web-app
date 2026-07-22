import { useState } from 'react'
import { Landmark, Pencil, Plus, Trash2 } from 'lucide-react'
import { useAccounts, useCreateAccount, useDeleteAccount, useUpdateAccount } from '../hooks/useAccounts'
import { useToastStore } from '../store/toastStore'
import { Card } from '../components/ui/Card'
import { IconCircle } from '../components/ui/IconCircle'
import { Toggle } from '../components/ui/Toggle'
import { colorFromString } from '../utils/colorFromString'
import { formatCurrency } from '../utils/currency'
import type { AccountInput } from '../api/accounts'
import type { AccountResponse } from '../api/types'

const EMPTY_FORM: AccountInput = { name: '', description: '', initialValue: 0, isDefault: false }

export function AccountsPage() {
  const { data: accounts, isLoading, isError } = useAccounts()
  const createAccount = useCreateAccount()
  const updateAccount = useUpdateAccount()
  const deleteAccount = useDeleteAccount()

  const [editing, setEditing] = useState<AccountResponse | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<AccountResponse | null>(null)

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(account: AccountResponse) {
    setEditing(account)
    setFormOpen(true)
  }

  function handleSubmit(input: AccountInput) {
    if (editing) {
      updateAccount.mutate(
        { id: editing.id, input },
        {
          onSuccess: () => {
            useToastStore.getState().show('Conta atualizada.')
            setFormOpen(false)
          },
          onError: (error) => useToastStore.getState().show(error instanceof Error ? error.message : 'Falha ao salvar conta.'),
        },
      )
    } else {
      createAccount.mutate(input, {
        onSuccess: () => {
          useToastStore.getState().show('Conta criada.')
          setFormOpen(false)
        },
        onError: (error) => useToastStore.getState().show(error instanceof Error ? error.message : 'Falha ao salvar conta.'),
      })
    }
  }

  function handleDelete() {
    if (!pendingDelete) return
    deleteAccount.mutate(pendingDelete.id, {
      onSuccess: () => {
        useToastStore.getState().show('Conta removida.')
        setPendingDelete(null)
      },
      onError: (error) => useToastStore.getState().show(error instanceof Error ? error.message : 'Falha ao remover conta.'),
    })
  }

  if (isLoading) return <CenteredMessage text="Carregando..." />
  if (isError || !accounts) return <CenteredMessage text="Não foi possível carregar suas contas." />

  const pending = createAccount.isPending || updateAccount.isPending

  return (
    <div>
      {formOpen && (
        <AccountFormModal
          initial={editing ? { name: editing.name, description: editing.description, initialValue: editing.initialValue, isDefault: editing.isDefault } : EMPTY_FORM}
          title={editing ? 'Editar conta' : 'Nova conta'}
          pending={pending}
          onCancel={() => setFormOpen(false)}
          onSubmit={handleSubmit}
        />
      )}

      {pendingDelete && (
        <ConfirmDeleteModal
          name={pendingDelete.name}
          pending={deleteAccount.isPending}
          onCancel={() => setPendingDelete(null)}
          onConfirm={handleDelete}
        />
      )}

      {/* Mobile */}
      <div className="lg:hidden flex flex-col h-screen">
        <div className="flex items-center justify-between px-4 h-14">
          <h1 className="text-[22px] font-bold">Contas</h1>
          <button onClick={openCreate} className="text-brand">
            <Plus size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 flex flex-col gap-3 pb-6">
          {accounts.length === 0 && <EmptyState />}
          {accounts.map((account) => (
            <AccountRow key={account.id} account={account} onEdit={() => openEdit(account)} onDelete={() => setPendingDelete(account)} />
          ))}
        </div>
      </div>

      {/* Desktop */}
      <div className="hidden lg:flex flex-col gap-6 p-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Contas</h1>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 h-10 px-4 rounded-[10px] bg-brand text-sm font-semibold"
          >
            <Plus size={16} /> Adicionar Conta
          </button>
        </div>

        {accounts.length === 0 && <EmptyState />}

        <div className="flex flex-col gap-3">
          {accounts.map((account) => (
            <AccountRow key={account.id} account={account} onEdit={() => openEdit(account)} onDelete={() => setPendingDelete(account)} />
          ))}
        </div>
      </div>
    </div>
  )
}

function CenteredMessage({ text }: { text: string }) {
  return <div className="flex items-center justify-center min-h-[60vh] text-sm text-muted">{text}</div>
}

function EmptyState() {
  return <p className="text-sm text-muted text-center pt-8">Nenhuma conta cadastrada.</p>
}

function AccountRow({
  account,
  onEdit,
  onDelete,
}: {
  account: AccountResponse
  onEdit: () => void
  onDelete: () => void
}) {
  const accent = colorFromString(account.id)
  return (
    <Card className="flex items-center gap-3 p-3.5">
      <IconCircle background={`${accent}20`} size={40}>
        <Landmark size={18} style={{ color: accent }} />
      </IconCircle>
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold truncate">{account.name}</span>
          {account.isDefault && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-brand/20 text-brand-light">
              Padrão
            </span>
          )}
        </div>
        {account.description && <span className="text-xs text-muted truncate">{account.description}</span>}
      </div>
      <span className={`text-sm font-semibold ${account.value >= 0 ? 'text-positive' : 'text-negative'}`}>
        {formatCurrency(account.value)}
      </span>
      <div className="flex items-center gap-1">
        <button onClick={onEdit} className="w-8 h-8 flex items-center justify-center rounded-lg text-muted bg-surface">
          <Pencil size={14} />
        </button>
        <button onClick={onDelete} className="w-8 h-8 flex items-center justify-center rounded-lg text-negative bg-surface">
          <Trash2 size={14} />
        </button>
      </div>
    </Card>
  )
}

function AccountFormModal({
  initial,
  title,
  pending,
  onCancel,
  onSubmit,
}: {
  initial: AccountInput
  title: string
  pending: boolean
  onCancel: () => void
  onSubmit: (input: AccountInput) => void
}) {
  const [name, setName] = useState(initial.name)
  const [description, setDescription] = useState(initial.description)
  const [initialValue, setInitialValue] = useState(String(initial.initialValue))
  const [isDefault, setIsDefault] = useState(initial.isDefault)

  const valid = name.trim().length > 0

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    onSubmit({
      name: name.trim(),
      description: description.trim(),
      initialValue: Number(initialValue.replace(',', '.')) || 0,
      isDefault,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-2xl bg-card p-5 flex flex-col gap-4">
        <h2 className="text-base font-bold">{title}</h2>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Nome</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className="h-10 px-3 rounded-lg bg-surface border border-border text-sm outline-none"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Descrição</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="h-10 px-3 rounded-lg bg-surface border border-border text-sm outline-none"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Saldo inicial</span>
          <input
            value={initialValue}
            onChange={(e) => setInitialValue(e.target.value)}
            inputMode="decimal"
            className="h-10 px-3 rounded-lg bg-surface border border-border text-sm outline-none"
          />
        </label>

        <div className="flex items-center justify-between">
          <span className="text-sm">Conta padrão</span>
          <Toggle checked={isDefault} onChange={setIsDefault} />
        </div>

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

function ConfirmDeleteModal({
  name,
  pending,
  onCancel,
  onConfirm,
}: {
  name: string
  pending: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-card p-5 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-base font-bold">Remover conta</h2>
          <p className="text-sm text-muted">
            Isso vai remover <span className="font-semibold text-white">{name}</span> da sua lista de contas.
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
