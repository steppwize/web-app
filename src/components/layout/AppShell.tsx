import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { BottomTabBar } from './BottomTabBar'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex bg-bg text-white">
      <Sidebar />
      <div className="flex-1 min-w-0 pb-28 lg:pb-0">{children}</div>
      <BottomTabBar />
    </div>
  )
}
