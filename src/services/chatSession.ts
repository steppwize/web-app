// Per-tab current chat session id. sessionStorage (not localStorage) is what gives "new tab/window
// = fresh conversation" for free: it's isolated per tab and empty on first read, but survives a
// same-tab reload — so refreshing keeps the in-progress conversation, matching VS Code Copilot Chat.
const KEY = 'steppwize:chat-session-id'

export function getCurrentSessionId(): string {
  let id = sessionStorage.getItem(KEY)
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem(KEY, id)
  }
  return id
}

export function startNewSession(): string {
  const id = crypto.randomUUID()
  sessionStorage.setItem(KEY, id)
  return id
}

export function setCurrentSessionId(id: string): void {
  sessionStorage.setItem(KEY, id)
}
