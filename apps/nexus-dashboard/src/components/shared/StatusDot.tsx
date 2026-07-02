interface StatusDotProps {
  status: 'healthy' | 'warning' | 'critical' | 'inactive'
  size?: 'sm' | 'md'
}

const colors = {
  healthy: 'bg-success',
  warning: 'bg-warning',
  critical: 'bg-danger',
  inactive: 'bg-text-muted',
}

const sizes = {
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
}

export function StatusDot({ status, size = 'sm' }: StatusDotProps) {
  return (
    <span className={`inline-block rounded-full ${sizes[size]} ${colors[status]}`} />
  )
}
