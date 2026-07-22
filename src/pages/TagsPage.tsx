import { useState } from 'react'
import { Pencil, Plus, Tag as TagIcon, Trash2 } from 'lucide-react'
import { useCreateTag, useDeleteTag, useTags, useUpdateTag } from '../hooks/useTags'
import { useToastStore } from '../store/toastStore'
import { Card } from '../components/ui/Card'
import { IconCircle } from '../components/ui/IconCircle'
import { COLOR_SWATCHES } from '../utils/colorFromString'
import type { TagInput } from '../api/tags'
import type { TagResponse } from '../api/types'

const EMPTY_FORM: TagInput = { title: '', description: '', color: COLOR_SWATCHES[0] }

export function TagsPage() {
  const { data: tags, isLoading, isError } = useTags()
  const createTag = useCreateTag()
  const updateTag = useUpdateTag()
  const deleteTag = useDeleteTag()

  const [editing, setEditing] = useState<TagResponse | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<TagResponse | null>(null)

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(tag: TagResponse) {
    setEditing(tag)
    setFormOpen(true)
  }

  function handleSubmit(input: TagInput) {
    if (editing) {
      updateTag.mutate(
        { id: editing.id, input },
        {
          onSuccess: () => {
            useToastStore.getState().show('Tag atualizada.')
            setFormOpen(false)
          },
          onError: (error) => useToastStore.getState().show(error instanceof Error ? error.message : 'Falha ao salvar tag.'),
        },
      )
    } else {
      createTag.mutate(input, {
        onSuccess: () => {
          useToastStore.getState().show('Tag criada.')
          setFormOpen(false)
        },
        onError: (error) => useToastStore.getState().show(error instanceof Error ? error.message : 'Falha ao salvar tag.'),
      })
    }
  }

  function handleDelete() {
    if (!pendingDelete) return
    deleteTag.mutate(pendingDelete.id, {
      onSuccess: () => {
        useToastStore.getState().show('Tag removida.')
        setPendingDelete(null)
      },
      onError: (error) => useToastStore.getState().show(error instanceof Error ? error.message : 'Falha ao remover tag.'),
    })
  }

  if (isLoading) return <CenteredMessage text="Carregando..." />
  if (isError || !tags) return <CenteredMessage text="Não foi possível carregar suas tags." />

  const pending = createTag.isPending || updateTag.isPending

  return (
    <div>
      {formOpen && (
        <TagFormModal
          initial={editing ? { title: editing.title, description: editing.description, color: editing.color || COLOR_SWATCHES[0] } : EMPTY_FORM}
          title={editing ? 'Editar tag' : 'Nova tag'}
          pending={pending}
          onCancel={() => setFormOpen(false)}
          onSubmit={handleSubmit}
        />
      )}

      {pendingDelete && (
        <ConfirmDeleteModal
          name={pendingDelete.title}
          pending={deleteTag.isPending}
          onCancel={() => setPendingDelete(null)}
          onConfirm={handleDelete}
        />
      )}

      {/* Mobile */}
      <div className="lg:hidden flex flex-col h-screen">
        <div className="flex items-center justify-between px-4 h-14">
          <h1 className="text-[22px] font-bold">Tags</h1>
          <button onClick={openCreate} className="text-brand">
            <Plus size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 flex flex-col gap-3 pb-6">
          {tags.length === 0 && <EmptyState />}
          {tags.map((tag) => (
            <TagRow key={tag.id} tag={tag} onEdit={() => openEdit(tag)} onDelete={() => setPendingDelete(tag)} />
          ))}
        </div>
      </div>

      {/* Desktop */}
      <div className="hidden lg:flex flex-col gap-6 p-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Tags</h1>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 h-10 px-4 rounded-[10px] bg-brand text-sm font-semibold"
          >
            <Plus size={16} /> Adicionar Tag
          </button>
        </div>

        {tags.length === 0 && <EmptyState />}

        <div className="flex flex-col gap-3">
          {tags.map((tag) => (
            <TagRow key={tag.id} tag={tag} onEdit={() => openEdit(tag)} onDelete={() => setPendingDelete(tag)} />
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
  return <p className="text-sm text-muted text-center pt-8">Nenhuma tag cadastrada.</p>
}

function TagRow({ tag, onEdit, onDelete }: { tag: TagResponse; onEdit: () => void; onDelete: () => void }) {
  const color = tag.color || '#8B8FA8'
  return (
    <Card className="flex items-center gap-3 p-3.5">
      <IconCircle background={`${color}20`} size={40}>
        <TagIcon size={18} style={{ color }} />
      </IconCircle>
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className="text-sm font-semibold truncate">{tag.title}</span>
        {tag.description && tag.description !== tag.title && (
          <span className="text-xs text-muted truncate">{tag.description}</span>
        )}
      </div>
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

function TagFormModal({
  initial,
  title,
  pending,
  onCancel,
  onSubmit,
}: {
  initial: TagInput
  title: string
  pending: boolean
  onCancel: () => void
  onSubmit: (input: TagInput) => void
}) {
  const [name, setName] = useState(initial.title)
  const [description, setDescription] = useState(initial.description)
  const [color, setColor] = useState(initial.color)

  const valid = name.trim().length > 0

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    onSubmit({ title: name.trim(), description: description.trim(), color })
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

        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Cor</span>
          <div className="flex flex-wrap gap-2">
            {COLOR_SWATCHES.map((swatch) => (
              <button
                key={swatch}
                type="button"
                onClick={() => setColor(swatch)}
                className={`w-8 h-8 rounded-full ${color === swatch ? 'ring-2 ring-offset-2 ring-offset-card ring-white' : ''}`}
                style={{ background: swatch }}
              />
            ))}
          </div>
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
          <h2 className="text-base font-bold">Remover tag</h2>
          <p className="text-sm text-muted">
            Isso vai remover <span className="font-semibold text-white">{name}</span> da sua lista de tags.
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
