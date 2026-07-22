import type { ReactNode } from 'react'

interface IconCircleProps {
  background: string
  size?: number
  className?: string
  children: ReactNode
}

export function IconCircle({ background, size = 40, className = '', children }: IconCircleProps) {
  return (
    <div
      className={`flex items-center justify-center rounded-full shrink-0 ${className}`}
      style={{ width: size, height: size, background }}
    >
      {children}
    </div>
  )
}
