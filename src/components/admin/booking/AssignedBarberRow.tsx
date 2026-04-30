import { useState } from 'react'

interface AssignedBarberRowProps {
  assignedBarber: { id: string; name: string }
  availableBarbers: { id: string; name: string }[]
  onSwap: (barberId: string) => void
}

export function AssignedBarberRow({ assignedBarber, availableBarbers, onSwap }: AssignedBarberRowProps) {
  const [open, setOpen] = useState(false)

  const others = availableBarbers.filter((b) => b.id !== assignedBarber.id)
  const initials = assignedBarber.name
    .split(' ')
    .map((s) => s.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="rounded-lg border border-gray-200 bg-[#FAFAF8]">
      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-[#B08A3E]/15 text-[#8C6A28] text-xs font-semibold flex items-center justify-center flex-shrink-0">
            {initials || '?'}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] tracking-[0.08em] uppercase text-[#8A8A8A] font-medium leading-none">
              Tildelt frisør
            </p>
            <p className="text-sm text-ink mt-0.5 truncate">{assignedBarber.name}</p>
          </div>
        </div>
        {others.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-xs text-[#B08A3E] hover:text-[#8C6A28] transition-colors flex-shrink-0"
          >
            {open ? 'Annuller' : 'Skift →'}
          </button>
        )}
      </div>

      {open && others.length > 0 && (
        <div className="border-t border-gray-200 divide-y divide-gray-100">
          {others.map((b) => (
            <div key={b.id} className="flex items-center justify-between px-3.5 py-2">
              <span className="text-sm text-ink">{b.name}</span>
              <button
                type="button"
                onClick={() => {
                  onSwap(b.id)
                  setOpen(false)
                }}
                className="text-xs text-[#B08A3E] hover:text-[#8C6A28] font-medium transition-colors"
              >
                Vælg
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
