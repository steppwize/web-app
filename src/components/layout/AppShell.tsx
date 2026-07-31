import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { BottomTabBar } from './BottomTabBar'
import { ChatButton } from '../chat/ChatButton'
import { ChatModal } from '../chat/ChatModal'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="h-dvh flex bg-bg text-white overflow-hidden">
      <Sidebar />
      <div className="flex-1 min-w-0 min-h-0">{children}</div>
      <BottomTabBar />
      <ChatButton />
      <ChatModal />
    </div>
  )
}
