import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import type { LanguageModel } from 'ai'
import type { LlmSettings } from '../llmSettingsService'

// Every provider SDK here talks to the LLM API directly over fetch from the browser — there is no
// backend to proxy through (see CLAUDE.md). Anthropic's API rejects browser-origin requests unless
// this header opts in explicitly; OpenAI/Google/OpenRouter don't require an equivalent flag.
export function getChatModel(settings: LlmSettings): LanguageModel {
  switch (settings.provider) {
    case 'anthropic':
      return createAnthropic({
        apiKey: settings.apiKey,
        headers: { 'anthropic-dangerous-direct-browser-access': 'true' },
      })(settings.model)
    case 'openai':
      return createOpenAI({ apiKey: settings.apiKey })(settings.model)
    case 'google':
      return createGoogleGenerativeAI({ apiKey: settings.apiKey })(settings.model)
    case 'openrouter':
      return createOpenRouter({ apiKey: settings.apiKey })(settings.model)
  }
}
