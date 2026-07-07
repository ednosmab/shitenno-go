import { NavLink } from 'react-router-dom'
import { layers } from '@/data/navigation'

const shortLabels: Record<string, string> = {
  architecture: 'Arq',
  engineering: 'Eng',
}

const items = layers.slice(0, 5).map(l => ({
  to: l.items[0]?.to ?? '/',
  icon: l.icon,
  label: shortLabels[l.id] ?? l.label,
}))

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-surface-1/95 backdrop-blur-xl border-t border-border-subtle safe-area-pb">
      <div className="flex items-center justify-around h-14">
        {items.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `
              flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg
              transition-colors min-w-[48px]
              ${isActive
                ? 'text-accent-hover'
                : 'text-text-muted active:text-text-primary'
              }
            `}
          >
            <span className="text-base leading-none">{item.icon}</span>
            <span className="text-[10px] font-medium">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
