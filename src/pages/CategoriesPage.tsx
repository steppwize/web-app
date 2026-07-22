import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from '../hooks/useCategories'
import { useToastStore } from '../store/toastStore'
import { Card } from '../components/ui/Card'
import { IconCircle } from '../components/ui/IconCircle'
import { resolveCategoryIcon, CATEGORY_ICON_OPTIONS } from '../utils/categoryIcon'
import { COLOR_SWATCHES } from '../utils/colorFromString'
import type { CategoryInput } from '../api/categories'
import type { CategoryResponse } from '../api/types'

const EMPTY_FORM: CategoryInput = {
  name: '',
  color: COLOR_SWATCHES[0],
  icon: CATEGORY_ICON_OPTIONS[0],
  description: '',
  parentId: null,
}

export function CategoriesPage() {
  const { data: categories, isLoading, isError } = useCategories()
  const createCategory = useCreateCategory()
  const updateCategory = useUpdateCategory()
  const deleteCategory = useDeleteCategory()

  const [editing, setEditing] = useState<CategoryResponse | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<CategoryResponse | null>(null)

  const flatOptions = categories ? flattenForParentPicker(categories) : []

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(category: CategoryResponse) {
    setEditing(category)
    setFormOpen(true)
  }

  function handleSubmit(input: CategoryInput) {
    if (editing) {
      updateCategory.mutate(
        { id: editing.id, input },
        {
          onSuccess: () => {
            useToastStore.getState().show('Categoria atualizada.')
            setFormOpen(false)
          },
          onError: (error) =>
            useToastStore.getState().show(error instanceof Error ? error.message : 'Falha ao salvar categoria.'),
        },
      )
    } else {
      createCategory.mutate(input, {
        onSuccess: () => {
          useToastStore.getState().show('Categoria criada.')
          setFormOpen(false)
        },
        onError: (error) =>
          useToastStore.getState().show(error instanceof Error ? error.message : 'Falha ao salvar categoria.'),
      })
    }
  }

  function handleDelete() {
    if (!pendingDelete) return
    deleteCategory.mutate(pendingDelete.id, {
      onSuccess: () => {
        useToastStore.getState().show('Categoria removida.')
        setPendingDelete(null)
      },
      onError: (error) => {
        useToastStore.getState().show(error instanceof Error ? error.message : 'Falha ao remover categoria.')
        setPendingDelete(null)
      },
    })
  }

  if (isLoading) return <CenteredMessage text="Carregando..." />
  if (isError || !categories) return <CenteredMessage text="Não foi possível carregar suas categorias." />

  const pending = createCategory.isPending || updateCategory.isPending

  return (
    <div>
      {formOpen && (
        <CategoryFormModal
          initial={
            editing
              ? {
                  name: editing.name,
                  color: editing.color || COLOR_SWATCHES[0],
                  icon: editing.icon || CATEGORY_ICON_OPTIONS[0],
                  description: editing.description,
                  parentId: editing.parentId,
                }
              : EMPTY_FORM
          }
          title={editing ? 'Editar categoria' : 'Nova categoria'}
          excludeId={editing?.id ?? null}
          parentOptions={flatOptions}
          pending={pending}
          onCancel={() => setFormOpen(false)}
          onSubmit={handleSubmit}
        />
      )}

      {pendingDelete && (
        <ConfirmDeleteModal
          name={pendingDelete.name}
          pending={deleteCategory.isPending}
          onCancel={() => setPendingDelete(null)}
          onConfirm={handleDelete}
        />
      )}

      {/* Mobile */}
      <div className="lg:hidden flex flex-col h-screen">
        <div className="flex items-center justify-between px-4 h-14">
          <h1 className="text-[22px] font-bold">Categorias</h1>
          <button onClick={openCreate} className="text-brand">
            <Plus size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 flex flex-col gap-3 pb-6">
          {categories.length === 0 && <EmptyState />}
          <CategoryTree categories={categories} onEdit={openEdit} onDelete={setPendingDelete} />
        </div>
      </div>

      {/* Desktop */}
      <div className="hidden lg:flex flex-col gap-6 p-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Categorias</h1>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 h-10 px-4 rounded-[10px] bg-brand text-sm font-semibold"
          >
            <Plus size={16} /> Adicionar Categoria
          </button>
        </div>

        {categories.length === 0 && <EmptyState />}

        <div className="flex flex-col gap-3">
          <CategoryTree categories={categories} onEdit={openEdit} onDelete={setPendingDelete} />
        </div>
      </div>
    </div>
  )
}

function flattenForParentPicker(categories: CategoryResponse[]): { id: string; name: string }[] {
  const result: { id: string; name: string }[] = []
  for (const c of categories) {
    result.push({ id: c.id, name: c.name })
    for (const child of c.children) result.push({ id: child.id, name: `${c.name} / ${child.name}` })
  }
  return result
}

function CenteredMessage({ text }: { text: string }) {
  return <div className="flex items-center justify-center min-h-[60vh] text-sm text-muted">{text}</div>
}

function EmptyState() {
  return <p className="text-sm text-muted text-center pt-8">Nenhuma categoria cadastrada.</p>
}

function CategoryTree({
  categories,
  onEdit,
  onDelete,
}: {
  categories: CategoryResponse[]
  onEdit: (category: CategoryResponse) => void
  onDelete: (category: CategoryResponse) => void
}) {
  return (
    <>
      {categories.map((category) => (
        <div key={category.id} className="flex flex-col gap-2">
          <CategoryRow category={category} onEdit={() => onEdit(category)} onDelete={() => onDelete(category)} />
          {category.children.length > 0 && (
            <div className="flex flex-col gap-2 pl-6">
              {category.children.map((child) => (
                <CategoryRow key={child.id} category={child} onEdit={() => onEdit(child)} onDelete={() => onDelete(child)} />
              ))}
            </div>
          )}
        </div>
      ))}
    </>
  )
}

function CategoryRow({
  category,
  onEdit,
  onDelete,
}: {
  category: CategoryResponse
  onEdit: () => void
  onDelete: () => void
}) {
  const Icon = resolveCategoryIcon(category.icon)
  const color = category.color || '#8B8FA8'
  return (
    <Card className="flex items-center gap-3 p-3.5">
      <IconCircle background={`${color}20`} size={40}>
        <Icon size={18} style={{ color }} />
      </IconCircle>
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className="text-sm font-semibold truncate">{category.name}</span>
        {category.description && <span className="text-xs text-muted truncate">{category.description}</span>}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={onEdit}
          aria-label={`Editar ${category.name}`}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-muted bg-surface"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={onDelete}
          aria-label={`Remover ${category.name}`}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-negative bg-surface"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </Card>
  )
}

function CategoryFormModal({
  initial,
  title,
  excludeId,
  parentOptions,
  pending,
  onCancel,
  onSubmit,
}: {
  initial: CategoryInput
  title: string
  excludeId: string | null
  parentOptions: { id: string; name: string }[]
  pending: boolean
  onCancel: () => void
  onSubmit: (input: CategoryInput) => void
}) {
  const [name, setName] = useState(initial.name)
  const [description, setDescription] = useState(initial.description)
  const [color, setColor] = useState(initial.color)
  const [icon, setIcon] = useState(initial.icon)
  const [parentId, setParentId] = useState(initial.parentId ?? '')

  const valid = name.trim().length > 0
  const availableParents = parentOptions.filter((p) => p.id !== excludeId)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    onSubmit({
      name: name.trim(),
      description: description.trim(),
      color,
      icon,
      parentId: parentId || null,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-2xl bg-card p-5 flex flex-col gap-4 my-6">
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

        {availableParents.length > 0 && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-muted">Categoria pai</span>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="h-10 px-3 rounded-lg bg-surface border border-border text-sm outline-none"
            >
              <option value="">Nenhuma (categoria principal)</option>
              {availableParents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}

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

        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Ícone</span>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_ICON_OPTIONS.map((iconKey) => {
              const Icon = resolveCategoryIcon(iconKey)
              const selected = icon === iconKey
              return (
                <button
                  key={iconKey}
                  type="button"
                  onClick={() => setIcon(iconKey)}
                  className={`w-9 h-9 flex items-center justify-center rounded-lg ${
                    selected ? 'bg-brand text-white' : 'bg-surface text-muted'
                  }`}
                >
                  <Icon size={16} />
                </button>
              )
            })}
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
          <h2 className="text-base font-bold">Remover categoria</h2>
          <p className="text-sm text-muted">
            Isso vai remover <span className="font-semibold text-white">{name}</span> da sua lista de categorias.
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
