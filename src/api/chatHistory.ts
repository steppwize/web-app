import type { UIMessage } from 'ai'
import {
  getChatHistory as getChatHistoryService,
  saveChatHistory as saveChatHistoryService,
  clearChatHistory as clearChatHistoryService,
} from '../services/chatHistoryService'

export function getChatHistory() {
  return getChatHistoryService()
}

export function saveChatHistory(messages: UIMessage[]) {
  return saveChatHistoryService(messages)
}

export function clearChatHistory() {
  return clearChatHistoryService()
}
