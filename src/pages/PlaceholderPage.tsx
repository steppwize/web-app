import type { LucideIcon } from 'lucide-react'

interface PlaceholderPageProps {
  title: string
  icon: LucideIcon
}

export function PlaceholderPage({ title, icon: Icon }: PlaceholderPageProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[70vh] gap-4 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-card border border-border flex items-center justify-center">
        <Icon size={28} className="text-brand" />
      </div>
      <div>
        <h1 className="text-lg font-bold">{title}</h1>
        <p className="text-sm text-muted mt-1">Em breve</p>
      </div>
    </div>
  )
}
