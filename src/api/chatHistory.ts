import type { UIMessage } from 'ai'
import {
  getChatHistory as getChatHistoryService,
  saveChatHistory as saveChatHistoryService,
  deleteChatSession as deleteChatSessionService,
  listChatSessions as listChatSessionsService,
} from '../services/chatHistoryService'

export function getChatHistory(sessionId: string) {
  return getChatHistoryService(sessionId)
}

export function saveChatHistory(sessionId: string, messages: UIMessage[]) {
  return saveChatHistoryService(sessionId, messages)
}

export function deleteChatSession(sessionId: string) {
  return deleteChatSessionService(sessionId)
}

export function listChatSessions() {
  return listChatSessionsService()
}
