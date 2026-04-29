import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  padding?: 'sm' | 'md' | 'lg' | 'none'
}

export function Card({ children, className = '', padding = 'md' }: CardProps) {
  const padClass =
    padding === 'none' ? '' : padding === 'sm' ? 'p-4' : padding === 'lg' ? 'p-8' : 'p-6'
  return (
    <div
      className={`bg-white border border-[#E8E8E5] rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] ${padClass} ${className}`}
    >
      {children}
    </div>
  )
}
