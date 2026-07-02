import { ReactNode } from 'react'

interface CardProps {
  title?: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  onClick?: () => void
}

export function Card({ title, subtitle, action, children, className = '', onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`
        bg-surface-1 border border-border-subtle rounded-lg
        ${onClick ? 'cursor-pointer hover:border-border-default hover:bg-surface-2 transition-colors' : ''}
        ${className}
      `}
    >
      {(title || action) && (
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div>
            {title && <h3 className="text-sm font-semibold text-text-primary">{title}</h3>}
            {subtitle && <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="px-4 pb-4">{children}</div>
    </div>
  )
}
