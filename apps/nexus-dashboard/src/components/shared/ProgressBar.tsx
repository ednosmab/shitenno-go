interface ProgressBarProps {
  value: number
  max?: number
  color?: 'accent' | 'success' | 'warning' | 'danger'
  size?: 'sm' | 'md'
  showLabel?: boolean
}

const barColors = {
  accent: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
}

function getColor(value: number): 'accent' | 'success' | 'warning' | 'danger' {
  if (value >= 80) return 'success'
  if (value >= 60) return 'accent'
  if (value >= 40) return 'warning'
  return 'danger'
}

export function ProgressBar({ value, max = 100, color, size = 'md', showLabel = false }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  const c = color ?? getColor(pct)
  const heights = { sm: 'h-1', md: 'h-1.5' }

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between mb-1">
          <span className="text-xs text-text-secondary">{Math.round(pct)}%</span>
        </div>
      )}
      <div className={`w-full ${heights[size]} bg-surface-3 rounded-full overflow-hidden`}>
        <div
          className={`${heights[size]} ${barColors[c]} rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
