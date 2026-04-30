import { useState } from 'react'
import { WorkingHoursEditor } from './WorkingHoursEditor'
import { TimeOffManager } from './TimeOffManager'

interface BarberCardProps {
  barber: {
    id: string
    display_name: string
    photo_url: string | null
    is_active: boolean
    display_order: number
  }
}

type Panel = 'hours' | 'timeoff' | null

export function BarberCard({ barber }: BarberCardProps) {
  const [panel, setPanel] = useState<Panel>(null)

  const initials = barber.display_name
    .split(' ')
    .map((s) => s.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const toggle = (p: Panel) => setPanel((current) => (current === p ? null : p))

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-3">
        {barber.photo_url ? (
          <img
            src={barber.photo_url}
            alt={barber.display_name}
            className="w-14 h-14 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-[#B08A3E]/15 text-[#8C6A28] text-base font-semibold flex items-center justify-center flex-shrink-0">
            {initials || '?'}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{barber.display_name}</p>
          <span
            className={`inline-block mt-1 text-[10px] font-semibold tracking-[0.08em] uppercase px-2 py-0.5 rounded-full ${
              barber.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {barber.is_active ? 'Aktiv' : 'Inaktiv'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 border-t border-gray-100">
        <button
          onClick={() => toggle('hours')}
          className={`px-3 py-2.5 text-xs font-medium border-r border-gray-100 transition-colors ${
            panel === 'hours'
              ? 'bg-[#B08A3E]/10 text-[#8C6A28]'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          Arbejdstider
        </button>
        <button
          onClick={() => toggle('timeoff')}
          className={`px-3 py-2.5 text-xs font-medium transition-colors ${
            panel === 'timeoff'
              ? 'bg-[#B08A3E]/10 text-[#8C6A28]'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          Fridage
        </button>
      </div>

      {panel === 'hours' && (
        <div className="border-t border-gray-100 bg-gray-50/50">
          <WorkingHoursEditor barberId={barber.id} />
        </div>
      )}
      {panel === 'timeoff' && (
        <div className="border-t border-gray-100 bg-gray-50/50">
          <TimeOffManager barberId={barber.id} />
        </div>
      )}
    </div>
  )
}
