import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  padding?: 'sm' | 'md' | 'lg' | 'none'
}

export function Card({ children, className = '', padding = 'md' }: CardProps) {
  const padClass =
    padding === 'none' ? '' : padding === 'sm' ? 'p-4' : padding === 'lg' ? 'p-6' : 'p-5'
  return (
    <div className={`bg-white border border-gray-200 rounded-lg ${padClass} ${className}`}>
      {children}
    </div>
  )
}
