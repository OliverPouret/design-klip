import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useBarbers } from '../../hooks/useBarbers'
import { isoDate } from '../../lib/danishDates'

interface BookingBlock {
  id: string
  short_code: string
  starts_at: string
  ends_at: string
  duration_minutes: number
  status: string
  source: string
  barber_id: string
  customer: { id: string; full_name: string }
  service: { name_da: string }
}

const SLOT_HEIGHT = 60 // px per 30 minutes
const WEEKDAYS = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag']

export function TodayPage() {
  const { barbers } = useBarbers()
  const [viewDate, setViewDate] = useState(() => new Date())
  const [bookings, setBookings] = useState<BookingBlock[]>([])
  const [barberHours, setBarberHours] = useState<Record<string, { opens: string; closes: string } | null>>({})
  const [noteFlags, setNoteFlags] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [insights, setInsights] = useState<string | null>(null)
  const [insightsLoading, setInsightsLoading] = useState(false)

  useEffect(() => {
    if (barbers.length === 0) return

    const dayStart = new Date(viewDate.getFullYear(), viewDate.getMonth(), viewDate.getDate())
    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayEnd.getDate() + 1)
    const isoWd = viewDate.getDay() === 0 ? 7 : viewDate.getDay()

    const fetchData = async () => {
      // Bookings for the day
      const { data: bk } = await supabase
        .from('bookings')
        .select(`
          id, short_code, starts_at, ends_at, duration_minutes, status, source, barber_id,
          customer:customers!inner(id, full_name),
          service:services!inner(name_da)
        `)
        .gte('starts_at', dayStart.toISOString())
        .lt('starts_at', dayEnd.toISOString())
        .in('status', ['confirmed', 'pending', 'completed', 'no_show'])
        .order('starts_at')

      const bookingList = (bk ?? []) as unknown as BookingBlock[]

      // Customer note flags
      const customerIds = [...new Set(bookingList.map((b) => b.customer.id))]
      const flags: Record<string, boolean> = {}
      if (customerIds.length > 0) {
        const { data: notes } = await supabase
          .from('customer_notes')
          .select('customer_id')
          .in('customer_id', customerIds)
        ;(notes as { customer_id: string }[] | null)?.forEach((n) => {
          flags[n.customer_id] = true
        })
      }

      // Barber hours for this weekday
      const { data: hours } = await supabase
        .from('barber_hours')
        .select('barber_id, opens_at, closes_at')
        .eq('isoweekday', isoWd)

      const hoursMap: Record<string, { opens: string; closes: string } | null> = {}
      barbers.forEach((b) => {
        hoursMap[b.id] = null
      })
      ;(hours as { barber_id: string; opens_at: string | null; closes_at: string | null }[] | null)?.forEach(
        (h) => {
          if (h.opens_at && h.closes_at) {
            hoursMap[h.barber_id] = { opens: h.opens_at, closes: h.closes_at }
          }
        },
      )

      setBookings(bookingList)
      setNoteFlags(flags)
      setBarberHours(hoursMap)
      setLoading(false)
    }

    fetchData()
  }, [viewDate, barbers])

  // Calculate the time range for the grid
  const allOpens = Object.values(barberHours).filter((h): h is { opens: string; closes: string } => Boolean(h)).map((h) => h.opens)
  const allCloses = Object.values(barberHours).filter((h): h is { opens: string; closes: string } => Boolean(h)).map((h) => h.closes)
  const gridStart = allOpens.length > 0 ? allOpens.sort()[0] : '09:00'
  const gridEnd = allCloses.length > 0 ? allCloses.sort().reverse()[0] : '17:00'

  const startMinutes = parseInt(gridStart.split(':')[0]) * 60 + parseInt(gridStart.split(':')[1])
  const endMinutes = parseInt(gridEnd.split(':')[0]) * 60 + parseInt(gridEnd.split(':')[1])
  const totalSlots = Math.ceil((endMinutes - startMinutes) / 30)
  const totalHeight = totalSlots * SLOT_HEIGHT

  const timeLabels: string[] = []
  for (let m = startMinutes; m < endMinutes; m += 30) {
    const h = Math.floor(m / 60).toString().padStart(2, '0')
    const min = (m % 60).toString().padStart(2, '0')
    timeLabels.push(`${h}:${min}`)
  }

  const getBlockStyle = (booking: BookingBlock) => {
    const bStart = new Date(booking.starts_at)
    const bookingMinutes = bStart.getHours() * 60 + bStart.getMinutes()
    const offset = bookingMinutes - startMinutes
    const top = (offset / 30) * SLOT_HEIGHT
    const height = (booking.duration_minutes / 30) * SLOT_HEIGHT
    return { top: `${top}px`, height: `${height}px` }
  }

  const prevDay = () => {
    const d = new Date(viewDate)
    d.setDate(d.getDate() - 1)
    setViewDate(d)
  }
  const nextDay = () => {
    const d = new Date(viewDate)
    d.setDate(d.getDate() + 1)
    setViewDate(d)
  }
  const goToday = () => setViewDate(new Date())

  const isToday = isoDate(viewDate) === isoDate(new Date())

  const handleGenerateInsights = async () => {
    setInsightsLoading(true)
    try {
      const res = await fetch('/api/generate-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = (await res.json()) as { insights?: string }
      if (data.insights) setInsights(data.insights)
    } finally {
      setInsightsLoading(false)
    }
  }

  if (loading) return <p className="text-sm text-ink-subtle">Henter program…</p>

  return (
    <div>
      {/* Business insights */}
      <div className="bg-white border border-border rounded-sm p-4 mb-4">
        {!insights ? (
          <button
            onClick={handleGenerateInsights}
            disabled={insightsLoading}
            className="flex items-center gap-2 text-sm text-accent-deep hover:text-ink transition-colors disabled:opacity-60"
          >
            {insightsLoading ? 'Analyserer…' : '📊 Forretningsoverblik'}
          </button>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs tracking-[0.08em] uppercase text-ink-subtle">Forretningsoverblik</p>
              <button onClick={() => setInsights(null)} className="text-[0.625rem] text-ink-subtle hover:text-ink">
                Luk
              </button>
            </div>
            <div className="text-sm text-ink leading-relaxed whitespace-pre-line">{insights}</div>
          </div>
        )}
      </div>

      {/* Day navigation */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevDay} className="text-sm text-ink-muted hover:text-ink transition-colors">
          ← Forrige
        </button>
        <div className="text-center">
          <h1 className="font-serif text-lg text-ink">
            {WEEKDAYS[viewDate.getDay()]} d. {viewDate.getDate()}.{' '}
            {viewDate.toLocaleDateString('da-DK', { month: 'long' })}
          </h1>
          {!isToday && (
            <button onClick={goToday} className="text-xs text-accent-deep hover:text-ink mt-1">
              I dag
            </button>
          )}
        </div>
        <button onClick={nextDay} className="text-sm text-ink-muted hover:text-ink transition-colors">
          Næste →
        </button>
      </div>

      {/* Schedule grid */}
      <div className="bg-white border border-border rounded-sm overflow-x-auto">
        <div className="min-w-[500px]">
          {/* Barber headers */}
          <div
            className="grid border-b border-border"
            style={{ gridTemplateColumns: `50px repeat(${barbers.length}, 1fr)` }}
          >
            <div className="p-2 bg-surface" />
            {barbers.map((barber) => {
              const hours = barberHours[barber.id]
              const isOff = !hours
              return (
                <div
                  key={barber.id}
                  className={`p-2 text-center border-l border-border ${isOff ? 'bg-border/20' : 'bg-surface'}`}
                >
                  <p className="text-xs font-medium text-ink">{barber.display_name}</p>
                  {isOff && <p className="text-[0.625rem] text-ink-subtle">Fri i dag</p>}
                </div>
              )
            })}
          </div>

          {/* Timeline body */}
          <div className="grid" style={{ gridTemplateColumns: `50px repeat(${barbers.length}, 1fr)` }}>
            {/* Time labels column */}
            <div className="relative" style={{ height: `${totalHeight}px` }}>
              {timeLabels.map((label, i) => (
                <div
                  key={label}
                  className="absolute right-0 pr-2 text-right"
                  style={{ top: `${i * SLOT_HEIGHT}px`, height: `${SLOT_HEIGHT}px`, lineHeight: `${SLOT_HEIGHT}px` }}
                >
                  <span className="text-[0.6875rem] text-ink-subtle">{label}</span>
                </div>
              ))}
            </div>

            {/* Barber columns */}
            {barbers.map((barber) => {
              const hours = barberHours[barber.id]
              const isOff = !hours
              const barberBookings = bookings.filter((b) => b.barber_id === barber.id)

              return (
                <div
                  key={barber.id}
                  className={`relative border-l border-border ${isOff ? 'bg-border/10' : ''}`}
                  style={{ height: `${totalHeight}px` }}
                >
                  {/* Grid lines */}
                  {timeLabels.map((_, i) => (
                    <div
                      key={`grid-${barber.id}-${i}`}
                      className="absolute left-0 right-0 border-b border-border/30"
                      style={{ top: `${i * SLOT_HEIGHT}px` }}
                    />
                  ))}

                  {/* Booking blocks */}
                  {!isOff &&
                    barberBookings.map((booking) => {
                      const style = getBlockStyle(booking)
                      const hasNote = noteFlags[booking.customer.id]
                      return (
                        <Link
                          key={booking.id}
                          to={`/admin/booking/${booking.id}`}
                          className="absolute left-1 right-1 rounded-sm overflow-hidden hover:ring-1 hover:ring-accent transition-all"
                          style={{ top: style.top, height: style.height, minHeight: '28px' }}
                        >
                          <div
                            className="h-full border-l-[3px] px-2 py-1 bg-surface"
                            style={{ borderColor: barber.profile_color || '#B08A3E' }}
                          >
                            <div className="flex items-center gap-1">
                              <span className="text-[0.6875rem] font-medium text-ink truncate">
                                {booking.customer.full_name}
                              </span>
                              {hasNote && (
                                <span className="flex-shrink-0 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[0.5rem] flex items-center justify-center font-bold">
                                  !
                                </span>
                              )}
                            </div>
                            <p className="text-[0.625rem] text-ink-muted truncate">
                              {booking.service.name_da}
                              {booking.source === 'phone' && ' · 📞'}
                            </p>
                          </div>
                        </Link>
                      )
                    })}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between mt-3 text-xs text-ink-subtle">
        <span>{bookings.filter((b) => b.status !== 'cancelled').length} bookinger</span>
        <span>{bookings.filter((b) => b.source === 'phone').length} telefonbookinger</span>
      </div>
    </div>
  )
}
