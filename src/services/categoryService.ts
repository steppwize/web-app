import { and, eq } from 'drizzle-orm'
import { db } from '../db/client'
import { categories } from '../db/schema'
import { toNaiveTimestamp } from './dates'
import type { CategoryResponse } from '../api/types'

function toResponse(row: typeof categories.$inferSelect): CategoryResponse {
  return {
    id: row.id,
    name: row.name ?? '',
    color: row.color ?? '',
    icon: row.icon ?? '',
    description: row.description ?? '',
    parentId: row.parentCategory,
    children: [],
  }
}

export async function getCategories(): Promise<CategoryResponse[]> {
  const rows = await db.select().from(categories).where(eq(categories.deleted, false))
  const byId = new Map(rows.map((r) => [r.id, toResponse(r)]))

  const roots: CategoryResponse[] = []
  for (const row of rows) {
    const node = byId.get(row.id)!
    const parent = row.parentCategory ? byId.get(row.parentCategory) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  const sortByName = (a: CategoryResponse, b: CategoryResponse) => a.name.localeCompare(b.name)
  for (const node of byId.values()) node.children.sort(sortByName)
  roots.sort(sortByName)
  return roots
}

export interface CategoryInput {
  name: string
  color: string
  icon: string
  description: string
  parentId: string | null
}

export async function createCategory(input: CategoryInput): Promise<CategoryResponse> {
  const [row] = await db
    .insert(categories)
    .values({
      id: crypto.randomUUID(),
      name: input.name,
      color: input.color,
      icon: input.icon,
      description: input.description,
      parentCategory: input.parentId,
    })
    .returning()

  return toResponse(row)
}

export async function updateCategory(id: string, input: CategoryInput): Promise<CategoryResponse> {
  const [row] = await db
    .update(categories)
    .set({
      name: input.name,
      color: input.color,
      icon: input.icon,
      description: input.description,
      parentCategory: input.parentId,
      updatedAt: toNaiveTimestamp(new Date()),
    })
    .where(eq(categories.id, id))
    .returning()
  if (!row) throw new Error('Categoria não encontrada.')

  return toResponse(row)
}

export async function deleteCategory(id: string): Promise<{ message: string }> {
  const [child] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.parentCategory, id), eq(categories.deleted, false)))
    .limit(1)
  if (child) throw new Error('Remova ou mova as subcategorias antes de excluir esta categoria.')

  await db
    .update(categories)
    .set({ deleted: true, updatedAt: toNaiveTimestamp(new Date()) })
    .where(eq(categories.id, id))
  return { message: 'Categoria removida.' }
}
