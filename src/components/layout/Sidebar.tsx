import { NavLink } from 'react-router-dom'
import { Wallet } from 'lucide-react'
import { NAV_ITEMS } from './navItems'

export function Sidebar() {
  return (
    <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-2.5 h-[72px] px-5">
        <Wallet size={22} className="text-brand" />
        <span className="text-base font-bold text-brand">Steppwize</span>
      </div>
      <nav className="flex-1 flex flex-col gap-1 px-2">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex items-center gap-2.5 h-10 px-3 rounded-lg text-sm transition-colors ${
                isActive ? 'bg-brand text-white font-semibold' : 'text-muted hover:bg-card'
              }`
            }
          >
            <item.icon size={18} />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <NavLink
        to="/backup"
        className="flex items-center gap-2.5 h-[72px] px-5 border-t border-border text-xs text-muted hover:text-white"
      >
        Dados salvos neste dispositivo
      </NavLink>
    </aside>
  )
}
