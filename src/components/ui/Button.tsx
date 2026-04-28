import { type ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost'
  size?: 'default' | 'large'
}

export function Button({ variant = 'primary', size = 'default', className = '', children, ...props }: ButtonProps) {
  const base = 'inline-flex items-center justify-center font-sans font-medium tracking-[0.08em] uppercase transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-glow focus-visible:ring-offset-2'
  const sizes = {
    default: 'px-7 py-3 text-[0.8125rem]',
    large: 'px-10 py-4 text-[0.875rem]',
  }
  const variants = {
    primary: 'bg-accent text-white border border-accent hover:bg-accent-deep hover:border-accent-deep',
    ghost: 'bg-transparent text-ink border border-accent hover:bg-accent hover:text-white',
  }

  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  )
}
