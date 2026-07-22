import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { tags } from '../db/schema'
import { toNaiveTimestamp } from './dates'
import type { TagResponse } from '../api/types'

function toResponse(row: typeof tags.$inferSelect): TagResponse {
  return {
    id: row.id,
    title: row.title ?? '',
    description: row.description ?? '',
    color: row.color ?? '',
  }
}

export async function getTags(): Promise<TagResponse[]> {
  const rows = await db.select().from(tags).where(eq(tags.deleted, false))
  return rows.map(toResponse).sort((a, b) => a.title.localeCompare(b.title))
}

export interface TagInput {
  title: string
  description: string
  color: string
}

export async function createTag(input: TagInput): Promise<TagResponse> {
  const [row] = await db
    .insert(tags)
    .values({ id: crypto.randomUUID(), ...input })
    .returning()
  return toResponse(row)
}

export async function updateTag(id: string, input: TagInput): Promise<TagResponse> {
  const [row] = await db
    .update(tags)
    .set({ ...input, updatedAt: toNaiveTimestamp(new Date()) })
    .where(eq(tags.id, id))
    .returning()
  if (!row) throw new Error('Tag não encontrada.')
  return toResponse(row)
}

export async function deleteTag(id: string): Promise<{ message: string }> {
  await db
    .update(tags)
    .set({ deleted: true, updatedAt: toNaiveTimestamp(new Date()) })
    .where(eq(tags.id, id))
  return { message: 'Tag removida.' }
}
