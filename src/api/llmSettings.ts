import {
  getLlmSettings as getLlmSettingsService,
  saveLlmSettings as saveLlmSettingsService,
  clearLlmSettings as clearLlmSettingsService,
  type LlmSettings,
} from '../services/llmSettingsService'

export function getLlmSettings() {
  return getLlmSettingsService()
}

export function saveLlmSettings(input: LlmSettings) {
  return saveLlmSettingsService(input)
}

export function clearLlmSettings() {
  return clearLlmSettingsService()
}

export type { LlmSettings }
