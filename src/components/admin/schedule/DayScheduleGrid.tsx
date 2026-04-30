import { useEffect, useRef, useState } from 'react'
import { isoWeekday } from '../../../lib/danishDates'

export interface ScheduleBarber {
  id: string
  display_name: string
  profile_color?: string | null
}

export interface ScheduleBooking {
  id: string
  starts_at: string
  ends_at: string
  duration_minutes: number
  status: string
  source: string
  barber_id: string
  customer: { id: string; full_name: string }
  service: { name_da: string }
}

interface DayScheduleGridProps {
  date: Date
  barbers: ScheduleBarber[]
  bookings: ScheduleBooking[]
  // Map<barberId, { opens: 'HH:mm', closes: 'HH:mm' } | null>. Null = day off.
  barberHours: Record<string, { opens: string; closes: string } | null>
  // Customer IDs that have non-empty notes — render a red ! badge on their blocks.
  notedCustomerIds?: Set<string>
  onBookingClick: (booking: ScheduleBooking) => void
}

const MIN_SLOT_HEIGHT = 30
const DEFAULT_SLOT_HEIGHT = 60

export function DayScheduleGrid({
  date,
  barbers,
  bookings,
  barberHours,
  notedCustomerIds,
  onBookingClick,
}: DayScheduleGridProps) {
  const [slotHeight, setSlotHeight] = useState(DEFAULT_SLOT_HEIGHT)
  const timelineBodyRef = useRef<HTMLDivElement>(null)

  const isoWd = isoWeekday(date)

  // Compute time range from barber_hours: earliest opens, latest closes (defaults 09–17)
  const allOpens = Object.values(barberHours)
    .filter((h): h is { opens: string; closes: string } => Boolean(h))
    .map((h) => h.opens)
  const allCloses = Object.values(barberHours)
    .filter((h): h is { opens: string; closes: string } => Boolean(h))
    .map((h) => h.closes)
  const gridStart = allOpens.length > 0 ? allOpens.sort()[0] : '09:00'
  const gridEnd = allCloses.length > 0 ? allCloses.sort().reverse()[0] : '17:00'

  const startMinutes = parseInt(gridStart.split(':')[0]) * 60 + parseInt(gridStart.split(':')[1])
  const endMinutes = parseInt(gridEnd.split(':')[0]) * 60 + parseInt(gridEnd.split(':')[1])
  const totalSlots = Math.max(1, Math.ceil((endMinutes - startMinutes) / 30))
  const totalHeight = totalSlots * slotHeight

  // Auto-fit slot height to available frame
  useEffect(() => {
    if (totalSlots === 0) return
    const el = timelineBodyRef.current
    if (!el) return
    const measure = () => {
      const available = el.clientHeight
      if (available > 0) {
        setSlotHeight(Math.max(MIN_SLOT_HEIGHT, available / totalSlots))
      }
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [totalSlots])

  const timeLabels: string[] = []
  for (let m = startMinutes; m < endMinutes; m += 30) {
    const h = Math.floor(m / 60).toString().padStart(2, '0')
    const min = (m % 60).toString().padStart(2, '0')
    timeLabels.push(`${h}:${min}`)
  }

  const getBlockStyle = (b: ScheduleBooking) => {
    const bStart = new Date(b.starts_at)
    const bookingMinutes = bStart.getHours() * 60 + bStart.getMinutes()
    const offset = bookingMinutes - startMinutes
    const top = (offset / 30) * slotHeight
    const height = (b.duration_minutes / 30) * slotHeight
    return { top: `${top}px`, height: `${height}px` }
  }

  void isoWd // referenced indirectly via barberHours map; suppress unused

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Barber headers */}
      <div
        className="grid border-b border-gray-200 rounded-t-lg overflow-hidden"
        style={{ gridTemplateColumns: `50px repeat(${barbers.length}, 1fr)` }}
      >
        <div className="p-2.5 bg-[#FAFAF8]" />
        {barbers.map((barber) => {
          const hours = barberHours[barber.id]
          const isOff = !hours
          return (
            <div
              key={barber.id}
              className={`p-2.5 text-center border-l border-gray-200 ${isOff ? 'bg-[#F0F0ED]' : 'bg-[#FAFAF8]'}`}
            >
              <p className="text-[13px] font-medium text-gray-900">{barber.display_name}</p>
              {isOff && <p className="text-[11px] text-gray-400 mt-0.5">Fri i dag</p>}
            </div>
          )
        })}
      </div>

      {/* Timeline body */}
      <div
        className="grid rounded-b-lg overflow-x-auto overflow-y-hidden"
        style={{ gridTemplateColumns: `50px repeat(${barbers.length}, 1fr)` }}
      >
        <div className="relative" style={{ height: `${totalHeight}px` }}>
          {timeLabels.map((label, i) => (
            <div
              key={label}
              className="absolute right-0 pr-2 text-right"
              style={{
                top: `${i * slotHeight}px`,
                height: `${slotHeight}px`,
                lineHeight: `${slotHeight}px`,
              }}
            >
              <span className="text-[11px] text-gray-400">{label}</span>
            </div>
          ))}
        </div>

        {barbers.map((barber) => {
          const hours = barberHours[barber.id]
          const isOff = !hours
          const barberBookings = bookings.filter((b) => b.barber_id === barber.id)

          return (
            <div
              key={barber.id}
              ref={timelineBodyRef}
              className={`relative border-l border-gray-200 ${isOff ? 'bg-[#F0F0ED]/40' : ''}`}
              style={{ height: `${totalHeight}px` }}
            >
              {isOff && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs text-gray-400 italic">Fridag</span>
                </div>
              )}
              {timeLabels.map((_, i) => (
                <div
                  key={`grid-${barber.id}-${i}`}
                  className="absolute left-0 right-0"
                  style={{ top: `${i * slotHeight}px`, borderBottom: '1px solid rgba(0,0,0,0.04)' }}
                />
              ))}
              {!isOff &&
                barberBookings.map((booking) => {
                  const style = getBlockStyle(booking)
                  const hasNote = notedCustomerIds?.has(booking.customer.id)
                  return (
                    <button
                      key={booking.id}
                      onClick={() => onBookingClick(booking)}
                      className="absolute left-1.5 right-1.5 rounded-lg overflow-hidden hover:ring-2 hover:ring-[#B08A3E]/40 transition-all text-left"
                      style={{ top: style.top, height: style.height, minHeight: '32px' }}
                    >
                      <div
                        className="h-full border-l-[3px] px-2.5 py-1.5"
                        style={{
                          borderColor: barber.profile_color || '#B08A3E',
                          backgroundColor: 'rgba(176, 138, 62, 0.15)',
                        }}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-[12px] font-medium text-gray-900 truncate">
                            {booking.customer.full_name}
                          </span>
                          {hasNote && (
                            <span className="flex-shrink-0 w-3.5 h-3.5 rounded-full bg-[#9B2C2C] text-white text-[8px] flex items-center justify-center font-bold leading-none">
                              !
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-600 truncate mt-0.5">
                          {booking.service.name_da}
                          {booking.source === 'phone' && ' · 📞'}
                        </p>
                      </div>
                    </button>
                  )
                })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
