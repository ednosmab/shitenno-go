interface ScoreGaugeProps {
  score: number
  size?: 'sm' | 'md' | 'lg'
  label?: string
  showValue?: boolean
}

function getColor(score: number): string {
  if (score >= 80) return 'var(--color-success)'
  if (score >= 60) return 'var(--color-info)'
  if (score >= 40) return 'var(--color-warning)'
  return 'var(--color-danger)'
}

const sizes = {
  sm: { ring: 64, stroke: 6, fontSize: 'text-lg', labelSize: 'text-[10px]' },
  md: { ring: 96, stroke: 8, fontSize: 'text-2xl', labelSize: 'text-xs' },
  lg: { ring: 128, stroke: 10, fontSize: 'text-3xl', labelSize: 'text-sm' },
}

export function ScoreGauge({ score, size = 'md', label, showValue = true }: ScoreGaugeProps) {
  const s = sizes[size]
  const radius = (s.ring - s.stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = getColor(score)

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: s.ring, height: s.ring }}>
        <svg width={s.ring} height={s.ring} className="-rotate-90">
          <circle
            cx={s.ring / 2}
            cy={s.ring / 2}
            r={radius}
            fill="none"
            stroke="var(--color-surface-3)"
            strokeWidth={s.stroke}
          />
          <circle
            cx={s.ring / 2}
            cy={s.ring / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={s.stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>
        {showValue && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`${s.fontSize} font-bold tabular-nums`} style={{ color }}>
              {score}
            </span>
          </div>
        )}
      </div>
      {label && (
        <span className={`${s.labelSize} text-text-secondary font-medium uppercase tracking-wider`}>
          {label}
        </span>
      )}
    </div>
  )
}
