interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-12 h-12 text-base',
}

export function Logo({ size = 'md', className = '' }: LogoProps) {
  return (
    <div
      className={`
        rounded-lg flex items-center justify-center
        bg-gradient-to-br from-accent to-purple
        shadow-lg shadow-accent/20
        ${sizes[size]} ${className}
      `}
    >
      <span className="text-white font-bold">N</span>
    </div>
  )
}
