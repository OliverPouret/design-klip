import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface EmptyStateProps {
  title: string
  body: string
  action?: { label: string; to?: string; onClick?: () => void }
  icon?: ReactNode
}

export function EmptyState({ title, body, action, icon }: EmptyStateProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 px-8 py-12 max-w-[480px] mx-auto text-center">
      {icon && (
        <div
          className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
          style={{ backgroundColor: '#F4F0E6', color: '#8C6A28' }}
        >
          {icon}
        </div>
      )}
      <h2 className="font-serif text-[22px] text-ink mb-2 leading-tight">{title}</h2>
      <p className="text-[14px] leading-relaxed text-gray-500 mb-6">{body}</p>
      {action &&
        (action.to ? (
          <Link
            to={action.to}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium transition-colors"
            style={{ backgroundColor: '#B08A3E', color: '#FFFFFF' }}
          >
            {action.label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={action.onClick}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium transition-colors"
            style={{ backgroundColor: '#B08A3E', color: '#FFFFFF' }}
          >
            {action.label}
          </button>
        ))}
    </div>
  )
}
