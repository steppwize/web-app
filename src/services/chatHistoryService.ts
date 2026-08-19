import { desc, eq } from 'drizzle-orm'
import type { UIMessage } from 'ai'
import { db } from '../db/client'
import { chatHistory } from '../db/schema'
import { toNaiveTimestamp } from './dates'

export interface ChatSessionSummary {
  id: string
  title: string
  updatedAt: string
}

export async function getChatHistory(sessionId: string): Promise<UIMessage[]> {
  const [row] = await db.select().from(chatHistory).where(eq(chatHistory.id, sessionId)).limit(1)
  if (!row) return []
  try {
    return JSON.parse(row.messages) as UIMessage[]
  } catch {
    return []
  }
}

export async function saveChatHistory(sessionId: string, messages: UIMessage[]): Promise<void> {
  const serialized = JSON.stringify(messages)
  const title = deriveTitle(messages)
  await db
    .insert(chatHistory)
    .values({ id: sessionId, title, messages: serialized })
    .onConflictDoUpdate({
      target: chatHistory.id,
      set: { title, messages: serialized, updatedAt: toNaiveTimestamp(new Date()) },
    })
}

export async function deleteChatSession(sessionId: string): Promise<void> {
  await db.delete(chatHistory).where(eq(chatHistory.id, sessionId))
}

export async function listChatSessions(): Promise<ChatSessionSummary[]> {
  const rows = await db
    .select({ id: chatHistory.id, title: chatHistory.title, updatedAt: chatHistory.updatedAt })
    .from(chatHistory)
    .orderBy(desc(chatHistory.updatedAt))
  return rows.map((row) => ({ ...row, title: row.title ?? 'Nova conversa' }))
}

// First user message's text, trimmed/truncated — matches how Copilot/Claude label a conversation
// from its opening line rather than requiring the user to name it.
function deriveTitle(messages: UIMessage[]): string {
  const firstUserMessage = messages.find((m) => m.role === 'user')
  const textPart = firstUserMessage?.parts.find((p) => p.type === 'text')
  const text = textPart && 'text' in textPart ? textPart.text.trim() : ''
  if (!text) return 'Nova conversa'
  return text.length > 50 ? `${text.slice(0, 50)}…` : text
}
