import { eq } from 'drizzle-orm'
import type { UIMessage } from 'ai'
import { db } from '../db/client'
import { chatHistory } from '../db/schema'
import { toNaiveTimestamp } from './dates'

const HISTORY_ID = 'default'

export async function getChatHistory(): Promise<UIMessage[]> {
  const [row] = await db.select().from(chatHistory).where(eq(chatHistory.id, HISTORY_ID)).limit(1)
  if (!row) return []
  try {
    return JSON.parse(row.messages) as UIMessage[]
  } catch {
    return []
  }
}

export async function saveChatHistory(messages: UIMessage[]): Promise<void> {
  const serialized = JSON.stringify(messages)
  await db
    .insert(chatHistory)
    .values({ id: HISTORY_ID, messages: serialized })
    .onConflictDoUpdate({
      target: chatHistory.id,
      set: { messages: serialized, updatedAt: toNaiveTimestamp(new Date()) },
    })
}

export async function clearChatHistory(): Promise<void> {
  await db.delete(chatHistory).where(eq(chatHistory.id, HISTORY_ID))
}
