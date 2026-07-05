interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: 'h-6 w-auto',
  md: 'h-8 w-auto',
  lg: 'h-16 w-auto',
}

export function Logo({ size = 'md', className = '' }: LogoProps) {
  return (
    <img
      src="/logo.png"
      alt="Nexus Logo"
      className={`block ${sizes[size]} object-contain ${className}`}
    />
  )
}
