import { useLocation } from 'react-router-dom'
import { Logo } from '../shared/Logo'
import { breadcrumbMap, subPageMap } from '@/data/navigation'

interface HeaderProps {
  onMenuToggle: () => void
  title: string
}

export function Header({ onMenuToggle, title }: HeaderProps) {
  const location = useLocation()
  const segments = location.pathname.split('/').filter(Boolean)
  const layer = segments[0] ?? ''
  const subPage = segments[1] ?? ''

  const layerLabel = breadcrumbMap[layer]
  const subPageLabel = subPageMap[subPage]

  return (
    <header className="sticky top-0 z-30 h-14 bg-surface-0/80 backdrop-blur-xl border-b border-border-subtle">
      <div className="flex items-center h-full px-4 gap-3">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-1.5 rounded-md hover:bg-surface-2 text-text-secondary hover:text-text-primary transition-colors"
          aria-label="Toggle menu"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="3" y1="5" x2="17" y2="5" />
            <line x1="3" y1="10" x2="17" y2="10" />
            <line x1="3" y1="15" x2="17" y2="15" />
          </svg>
        </button>

        <div className="hidden lg:flex items-center gap-2">
          <Logo size="sm" />
        </div>

        {layerLabel ? (
          <nav className="flex items-center gap-1.5 text-xs">
            <span className="text-text-muted">{layerLabel}</span>
            {subPageLabel && (
              <>
                <span className="text-text-muted">/</span>
                <span className="text-text-primary font-medium">{subPageLabel}</span>
              </>
            )}
          </nav>
        ) : (
          <h1 className="text-sm font-semibold text-text-primary">{title}</h1>
        )}

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-2 text-xs text-text-secondary">
            <span className="w-1.5 h-1.5 rounded-full bg-success" />
            <span>Live</span>
          </div>
        </div>
      </div>
    </header>
  )
}
