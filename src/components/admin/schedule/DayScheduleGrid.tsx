import { useEffect, useRef, useState, type CSSProperties } from 'react'
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
  klipNote?: { body: string } | null
}

interface DayScheduleGridProps {
  date: Date
  barbers: ScheduleBarber[]
  bookings: ScheduleBooking[]
  // Map<barberId, { opens: 'HH:mm', closes: 'HH:mm' } | null>. Null = day off.
  barberHours: Record<string, { opens: string; closes: string } | null>
  onBookingClick: (booking: ScheduleBooking) => void
}

const MIN_SLOT_HEIGHT = 30
const DEFAULT_SLOT_HEIGHT = 60

export function DayScheduleGrid({
  date,
  barbers,
  bookings,
  barberHours,
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

  const getBlockGeometry = (b: ScheduleBooking) => {
    const bStart = new Date(b.starts_at)
    const bookingMinutes = bStart.getHours() * 60 + bStart.getMinutes()
    const offset = bookingMinutes - startMinutes
    const top = (offset / 30) * slotHeight
    const naturalHeight = (b.duration_minutes / 30) * slotHeight
    // Cancelled bookings collapse to a one-line strip pinned to the top of
    // the original slot so the rest of the time reads as "free".
    const isCancelled = b.status === 'cancelled'
    const height = isCancelled ? Math.min(naturalHeight, 28) : naturalHeight
    return { top, height, naturalHeight, isCancelled }
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
              className={`p-2.5 text-center border-l border-gray-200 ${isOff ? 'bg-gray-100' : 'bg-[#FAFAF8]'}`}
            >
              <p className={`text-[13px] font-medium ${isOff ? 'text-gray-500' : 'text-gray-900'}`}>
                {barber.display_name}
              </p>
              {isOff && <p className="text-[11px] text-gray-500 italic mt-0.5">Fri i dag</p>}
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
              style={{ top: `${i * slotHeight}px` }}
            >
              <span className="text-[11px] text-gray-400 leading-none">{label}</span>
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
              className={`relative border-l border-gray-200 ${isOff ? 'bg-gray-100' : ''}`}
              style={{ height: `${totalHeight}px` }}
            >
              {isOff && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-xs text-gray-500 italic">Fridag</span>
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
                  const geom = getBlockGeometry(booking)
                  const isPastDue =
                    new Date(booking.ends_at).getTime() < Date.now() &&
                    (booking.status === 'confirmed' || booking.status === 'pending')

                  // Cancelled bookings always render as a compact one-liner
                  // (AFLYST eyebrow + customer name, line-through). All other
                  // info is intentionally hidden — the row only exists so the
                  // shop can reopen the modal and dismiss it.
                  if (geom.isCancelled) {
                    return (
                      <button
                        key={booking.id}
                        onClick={() => onBookingClick(booking)}
                        className="absolute left-1.5 right-1.5 rounded-lg overflow-hidden hover:ring-2 hover:ring-[#B08A3E]/40 transition-all text-left"
                        style={{ top: `${geom.top}px`, height: `${geom.height}px` }}
                      >
                        <div
                          className="h-full px-2.5 py-0.5 border-l-[3px] flex items-center gap-2"
                          style={{ backgroundColor: '#F4F4F4', borderColor: '#9A2A2A' }}
                        >
                          <span
                            className="font-serif-sc text-[9px] tracking-[0.18em] uppercase font-semibold flex-shrink-0"
                            style={{ color: '#9A2A2A' }}
                          >
                            Aflyst
                          </span>
                          <span
                            className="text-[13px] font-medium line-through truncate"
                            style={{ color: '#9A8870' }}
                          >
                            {booking.customer.full_name}
                          </span>
                        </div>
                      </button>
                    )
                  }

                  let blockClass: string
                  let blockStyle: CSSProperties = {}
                  let nameClass = 'text-gray-900'
                  let metaClass = 'text-gray-600'
                  let noteClass = 'text-gray-500'

                  if (booking.status === 'completed') {
                    blockClass = 'bg-gray-200 border-l-[3px] border-gray-300'
                    nameClass = 'text-gray-500'
                    metaClass = 'text-gray-400'
                    noteClass = 'text-gray-400'
                  } else if (booking.status === 'no_show') {
                    blockClass = 'bg-red-50 border-l-[3px] border-red-300'
                    nameClass = 'text-red-700'
                    metaClass = 'text-red-500'
                    noteClass = 'text-red-400'
                  } else if (isPastDue) {
                    blockClass = 'bg-amber-50 border-l-[3px] border-amber-500 animate-pulse-amber'
                    nameClass = 'text-gray-900'
                    metaClass = 'text-gray-700'
                    noteClass = 'text-gray-600'
                  } else {
                    blockClass = 'border-l-[3px]'
                    blockStyle = {
                      borderColor: barber.profile_color || '#B08A3E',
                      backgroundColor: 'rgba(176, 138, 62, 0.15)',
                    }
                  }

                  // Compactness levels for short bookings: under 32px shows
                  // only the customer name; under 50px adds service; 50px+
                  // gets the full layout including the klip note row.
                  const compact = geom.naturalHeight < 32
                  const medium = !compact && geom.naturalHeight < 50

                  return (
                    <button
                      key={booking.id}
                      onClick={() => onBookingClick(booking)}
                      className="absolute left-1.5 right-1.5 rounded-lg overflow-hidden hover:ring-2 hover:ring-[#B08A3E]/40 transition-all text-left"
                      style={{ top: `${geom.top}px`, height: `${geom.height}px`, minHeight: '32px' }}
                    >
                      <div
                        className={`h-full ${compact ? 'px-2.5 py-0.5' : 'px-2.5 py-1.5'} ${blockClass}`}
                        style={blockStyle}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[12px] font-medium truncate ${nameClass}`}>
                            {booking.customer.full_name}
                          </span>
                        </div>
                        {!compact && (
                          <p className={`text-[11px] truncate mt-0.5 ${metaClass}`}>
                            {booking.service.name_da}
                            {booking.source === 'phone' && ' · 📞'}
                          </p>
                        )}
                        {!compact && !medium && (
                          <p className={`text-[11px] truncate mt-0.5 ${noteClass}`}>
                            Note:{booking.klipNote?.body ? ` ${booking.klipNote.body}` : ''}
                          </p>
                        )}
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
