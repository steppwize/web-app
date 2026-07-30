import { asc } from 'drizzle-orm'
import { db } from '../db/client'
import { agentMemories } from '../db/schema'

export interface AgentMemory {
  id: string
  content: string
}

export async function listMemories(): Promise<AgentMemory[]> {
  const rows = await db
    .select({ id: agentMemories.id, content: agentMemories.content })
    .from(agentMemories)
    .orderBy(asc(agentMemories.createdAt))
  return rows
}

export async function saveMemory(content: string): Promise<AgentMemory> {
  const id = crypto.randomUUID()
  await db.insert(agentMemories).values({ id, content })
  return { id, content }
}
