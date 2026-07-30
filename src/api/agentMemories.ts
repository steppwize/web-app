import { listMemories as listMemoriesService, saveMemory as saveMemoryService } from '../services/agentMemoryService'

export function listMemories() {
  return listMemoriesService()
}

export function saveMemory(content: string) {
  return saveMemoryService(content)
}
