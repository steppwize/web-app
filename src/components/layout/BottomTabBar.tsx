import { NavLink } from 'react-router-dom'
import { NAV_ITEMS } from './navItems'

export function BottomTabBar() {
  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-20 bg-bg border-t border-border px-3 pt-2"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
    >
      <div className="flex items-center justify-between bg-surface rounded-full p-1 border border-border">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-1 h-[52px] rounded-full text-[9px] font-semibold tracking-wide ${
                isActive ? 'bg-brand text-white' : 'text-muted'
              }`
            }
          >
            <item.icon size={17} />
            <span>{item.label.toUpperCase()}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
