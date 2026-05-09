import { useEffect, useRef, useState, type ReactNode } from 'react'

interface Option<T extends string> {
  value: T
  label: string
}

interface FilterPillProps<T extends string> {
  label: string
  value?: T
  options?: Option<T>[]
  onChange?: (value: T) => void
  icon?: ReactNode
  disabled?: boolean
  // Renders as a static pill (no menu) when no options/onChange supplied —
  // useful for stubbed "Eksportér" button where the click does nothing yet.
  onClick?: () => void
}

const ICON_CHEVRON = (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

export function FilterPill<T extends string>({
  label,
  value,
  options,
  onChange,
  icon,
  disabled = false,
  onClick,
}: FilterPillProps<T>) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (!wrapperRef.current) return
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const hasMenu = !disabled && Array.isArray(options) && options.length > 0 && !!onChange

  const handleClick = () => {
    if (disabled) return
    if (hasMenu) {
      setOpen((o) => !o)
      return
    }
    onClick?.()
  }

  const baseClass =
    'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors'

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        aria-haspopup={hasMenu ? 'listbox' : undefined}
        aria-expanded={hasMenu ? open : undefined}
        className={baseClass}
        style={{
          backgroundColor: disabled ? '#F4F4F4' : '#F4F0E6',
          color: disabled ? '#9CA3AF' : '#2A2118',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        {icon && <span style={{ color: '#8C6A28' }}>{icon}</span>}
        <span>{label}</span>
        {hasMenu && <span style={{ color: '#8C6A28' }}>{ICON_CHEVRON}</span>}
      </button>

      {hasMenu && open && (
        <div
          role="listbox"
          className="absolute right-0 mt-1 z-20 min-w-[180px] rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden"
        >
          <ul className="py-1">
            {options.map((opt) => {
              const selected = opt.value === value
              return (
                <li key={opt.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      onChange?.(opt.value)
                      setOpen(false)
                    }}
                    className="w-full text-left px-3 py-2 text-[13px] transition-colors hover:bg-gray-50 flex items-center justify-between gap-2"
                    style={{
                      color: '#2A2118',
                      backgroundColor: selected ? '#F4F0E6' : 'transparent',
                      fontWeight: selected ? 500 : 400,
                    }}
                  >
                    <span>{opt.label}</span>
                    {selected && (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#8C6A28"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
