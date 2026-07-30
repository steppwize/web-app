import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { llmSettings } from '../db/schema'
import { toNaiveTimestamp } from './dates'

const SETTINGS_ID = 'default'

export type LlmProvider = 'anthropic' | 'openai' | 'google' | 'openrouter'

export interface LlmSettings {
  provider: LlmProvider
  apiKey: string
  model: string
}

export async function getLlmSettings(): Promise<LlmSettings | null> {
  const [row] = await db.select().from(llmSettings).where(eq(llmSettings.id, SETTINGS_ID)).limit(1)
  if (!row) return null
  return { provider: row.provider as LlmProvider, apiKey: row.apiKey, model: row.model }
}

export async function saveLlmSettings(input: LlmSettings): Promise<LlmSettings> {
  await db
    .insert(llmSettings)
    .values({ id: SETTINGS_ID, provider: input.provider, apiKey: input.apiKey, model: input.model })
    .onConflictDoUpdate({
      target: llmSettings.id,
      set: { provider: input.provider, apiKey: input.apiKey, model: input.model, updatedAt: toNaiveTimestamp(new Date()) },
    })
  return input
}

export async function clearLlmSettings(): Promise<void> {
  await db.delete(llmSettings).where(eq(llmSettings.id, SETTINGS_ID))
}
