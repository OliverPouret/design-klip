import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { isoDate, isoWeekday } from '../../lib/danishDates'
import { useAuth } from '../../lib/auth'
import { Card } from '../../components/admin/Card'
import { RescheduleModal } from '../../components/admin/booking/RescheduleModal'
import { DayScheduleGrid } from '../../components/admin/schedule/DayScheduleGrid'
import { useBarbers } from '../../hooks/useBarbers'

const MONTH_FULL = [
  'januar', 'februar', 'marts', 'april', 'maj', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'december',
]
const WEEKDAY_HEADERS = ['M', 'T', 'O', 'T', 'F', 'L', 'S']

interface DayBooking {
  id: string
  starts_at: string
  ends_at: string
  duration_minutes: number
  status: string
  source: string
  barber_id: string
  service_id: string
  customer_id: string
  customer: { id: string; full_name: string; phone_e164: string }
  service: { name_da: string }
  barber: { display_name: string; slug: string }
  klipNote?: { body: string } | null
}

export function CalendarPage() {
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [dayViewDate, setDayViewDate] = useState<Date | null>(null)
  const [dayBookings, setDayBookings] = useState<DayBooking[]>([])
  const [dayBarberHours, setDayBarberHours] = useState<
    Record<string, { opens: string; closes: string } | null>
  >({})
  const [manageBooking, setManageBooking] = useState<DayBooking | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [showReschedule, setShowReschedule] = useState(false)
  const [completingMode, setCompletingMode] = useState(false)
  const [completionNote, setCompletionNote] = useState('')
  const [monthRefreshKey, setMonthRefreshKey] = useState(0)
  const refreshMonth = () => setMonthRefreshKey((k) => k + 1)
  const [dayLoading, setDayLoading] = useState(false)
  const { barbers: activeBarbers } = useBarbers()
  const { user } = useAuth()

  const closeManageModal = () => {
    setManageBooking(null)
    setCompletingMode(false)
    setCompletionNote('')
  }

  const handleSaveAndComplete = async () => {
    if (!manageBooking) return
    const id = manageBooking.id
    const customerId = manageBooking.customer.id
    const day = dayViewDate
    const trimmed = completionNote.trim()
    setActionLoading(true)
    try {
      if (trimmed) {
        await supabase.from('customer_notes').insert({
          customer_id: customerId,
          author_id: user?.id ?? null,
          body: trimmed,
          tags: ['klip'],
          booking_id: id,
        })
      }
      await supabase.from('bookings').update({ status: 'completed' }).eq('id', id)
    } finally {
      setActionLoading(false)
      closeManageModal()
      refreshMonth()
      if (day) handleDayClick(day)
    }
  }

  useEffect(() => {
    const fetchCounts = async () => {
      const year = viewMonth.getFullYear()
      const month = viewMonth.getMonth()
      const firstOfMonth = new Date(year, month, 1)
      const firstOfNext = new Date(year, month + 1, 1)

      const { data } = await supabase
        .from('bookings')
        .select('starts_at')
        .gte('starts_at', firstOfMonth.toISOString())
        .lt('starts_at', firstOfNext.toISOString())
        .in('status', ['confirmed', 'pending', 'completed'])

      const map: Record<string, number> = {}
      ;(data as { starts_at: string }[] | null)?.forEach((row) => {
        const key = isoDate(new Date(row.starts_at))
        map[key] = (map[key] ?? 0) + 1
      })
      setCounts(map)
      setLoading(false)
    }
    fetchCounts()
  }, [viewMonth, monthRefreshKey])

  const year = viewMonth.getFullYear()
  const month = viewMonth.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  const startOffset = isoWeekday(firstOfMonth) - 1
  const calendarStart = new Date(year, month, 1 - startOffset)

  const days: Date[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(calendarStart)
    d.setDate(calendarStart.getDate() + i)
    days.push(d)
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayKey = isoDate(today)

  const monthCounts = Object.entries(counts).filter(([k]) => {
    const [y, m] = k.split('-').map((n) => parseInt(n, 10))
    return y === year && m === month + 1
  })
  const totalBookings = monthCounts.reduce((sum, [, c]) => sum + c, 0)
  const activeDays = monthCounts.length
  const avgPerDay = activeDays > 0 ? Math.round(totalBookings / activeDays) : 0
  const maxCount = Math.max(0, ...monthCounts.map(([, c]) => c))

  const goPrev = () => {
    const d = new Date(viewMonth)
    d.setMonth(d.getMonth() - 1)
    setViewMonth(d)
  }
  const goNext = () => {
    const d = new Date(viewMonth)
    d.setMonth(d.getMonth() + 1)
    setViewMonth(d)
  }

  const handleDayClick = async (date: Date) => {
    setDayViewDate(date)
    setDayLoading(true)
    setDayBookings([])

    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)

    const { data } = await supabase
      .from('bookings')
      .select(`
        id, starts_at, ends_at, duration_minutes, status, source, barber_id, service_id, customer_id,
        customer:customers!inner(id, full_name, phone_e164),
        service:services!inner(name_da),
        barber:barbers!inner(display_name, slug)
      `)
      .gte('starts_at', start.toISOString())
      .lt('starts_at', end.toISOString())
      .in('status', ['confirmed', 'pending', 'completed', 'no_show', 'cancelled'])
      .order('starts_at')

    let bookingList = (data ?? []) as unknown as DayBooking[]

    // Attach the most recent klip-tagged note per booking (linked by booking_id).
    const bookingIds = bookingList.map((b) => b.id)
    if (bookingIds.length > 0) {
      const { data: notes } = await supabase
        .from('customer_notes')
        .select('booking_id, body, created_at')
        .in('booking_id', bookingIds)
        .contains('tags', ['klip'])
        .order('created_at', { ascending: false })
      const noteMap = new Map<string, { body: string }>()
      ;(notes as { booking_id: string; body: string; created_at: string }[] | null)?.forEach((n) => {
        if (!noteMap.has(n.booking_id)) noteMap.set(n.booking_id, { body: n.body })
      })
      bookingList = bookingList.map((b) => ({ ...b, klipNote: noteMap.get(b.id) ?? null }))
    }

    setDayBookings(bookingList)

    // Fetch barber working hours for this weekday + accounting for time_off
    const wd = isoWeekday(date)
    const [hoursRes, timeOffRes] = await Promise.all([
      supabase.from('barber_hours').select('barber_id, opens_at, closes_at').eq('isoweekday', wd),
      supabase
        .from('time_off')
        .select('barber_id, starts_at, ends_at')
        .lte('starts_at', end.toISOString())
        .gte('ends_at', start.toISOString()),
    ])
    const hoursMap: Record<string, { opens: string; closes: string } | null> = {}
    ;(
      (hoursRes.data ?? []) as { barber_id: string; opens_at: string | null; closes_at: string | null }[]
    ).forEach((r) => {
      if (r.opens_at && r.closes_at) {
        hoursMap[r.barber_id] = { opens: r.opens_at.slice(0, 5), closes: r.closes_at.slice(0, 5) }
      }
    })
    // Mark off any barber who has time_off overlapping this day
    ;(
      (timeOffRes.data ?? []) as { barber_id: string }[]
    ).forEach((row) => {
      hoursMap[row.barber_id] = null
    })
    setDayBarberHours(hoursMap)
    setDayLoading(false)
  }

  // Real-time subscription: any booking change (insert/update/delete from any
  // device) triggers a re-fetch of month data and (if open) the day panel.
  // Requires Realtime enabled on bookings table in Supabase dashboard.
  useEffect(() => {
    const channel = supabase
      .channel('kalender-bookings-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => {
          refreshMonth()
          if (dayViewDate) handleDayClick(dayViewDate)
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [dayViewDate])

  return (
    <div className="md:h-full md:overflow-y-auto md:flex md:flex-col md:gap-3 md:pr-1 space-y-3 md:space-y-0">
      {/* Month nav */}
      <Card padding="sm" className="flex-shrink-0">
        <div className="flex items-center justify-between">
          <button
            onClick={goPrev}
            className="px-3 py-1.5 rounded-md text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          >
            ← Forrige
          </button>
          <h1 className="text-[18px] font-semibold text-gray-900 capitalize">
            {MONTH_FULL[month]} {year}
          </h1>
          <button
            onClick={goNext}
            className="px-3 py-1.5 rounded-md text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          >
            Næste →
          </button>
        </div>
      </Card>

      {/* Main row: calendar + side stats on desktop, stacked on mobile */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-3 flex-shrink-0">
        {/* Calendar grid */}
        <Card padding="sm">
          <div className="grid grid-cols-7 mb-2">
            {WEEKDAY_HEADERS.map((d, i) => (
              <div
                key={i}
                className="text-center py-1.5 text-[11px] font-semibold tracking-[0.08em] uppercase text-gray-400"
              >
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 grid-rows-6 gap-1">
            {days.map((d, i) => {
              const key = isoDate(d)
              const count = counts[key] ?? 0
              const isOutside = d.getMonth() !== month
              const isSunday = d.getDay() === 0
              const isToday = key === todayKey

              const intensity = maxCount > 0 ? (count / maxCount) * 0.3 : 0
              const bgStyle =
                count > 0 && !isOutside
                  ? { backgroundColor: `rgba(176, 138, 62, ${intensity + 0.06})` }
                  : undefined

              return (
                <button
                  key={i}
                  onClick={() => handleDayClick(d)}
                  disabled={loading}
                  className={`min-h-[64px] rounded-md text-left p-1.5 border border-gray-200 transition-colors flex flex-col ${
                    isOutside
                      ? 'opacity-30'
                      : isSunday
                        ? 'opacity-50'
                        : 'hover:ring-2 hover:ring-[#B08A3E]/30'
                  }`}
                  style={bgStyle}
                >
                  {isToday ? (
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#1A1A1A] text-white text-[12px] font-medium leading-none flex-shrink-0">
                        {d.getDate()}
                      </span>
                      <span className="text-[10px] font-medium text-gray-500">I dag</span>
                    </div>
                  ) : (
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[12px] font-medium leading-none flex-shrink-0 ${
                        isOutside || isSunday ? 'text-gray-400' : 'text-gray-900'
                      }`}
                    >
                      {d.getDate()}
                    </span>
                  )}
                  {count > 0 && !isOutside && (
                    <span className="text-[10px] text-[#8C6A28] font-medium mt-auto">
                      {count} {count === 1 ? 'booking' : 'bookinger'}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </Card>

        {/* Side stats on desktop */}
        <div className="grid grid-cols-3 md:grid-cols-1 gap-3 md:gap-3">
          <Card padding="sm">
            <p className="text-[11px] tracking-[0.08em] uppercase text-gray-400 font-semibold">Bookinger</p>
            <p className="text-[24px] font-semibold text-gray-900 mt-1 leading-none">{totalBookings}</p>
          </Card>
          <Card padding="sm">
            <p className="text-[11px] tracking-[0.08em] uppercase text-gray-400 font-semibold">Aktive dage</p>
            <p className="text-[24px] font-semibold text-gray-900 mt-1 leading-none">{activeDays}</p>
          </Card>
          <Card padding="sm">
            <p className="text-[11px] tracking-[0.08em] uppercase text-gray-400 font-semibold">Gns. pr. dag</p>
            <p className="text-[24px] font-semibold text-gray-900 mt-1 leading-none">{avgPerDay}</p>
          </Card>
        </div>
      </div>

      {/* Day panel — full schedule grid for the chosen day */}
      {dayViewDate && (
        <div className="flex-shrink-0">
          <div className="flex items-center justify-between px-1 mb-2">
            <h2 className="text-sm font-medium text-gray-900 capitalize">
              {dayViewDate.toLocaleDateString('da-DK', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </h2>
            <button
              onClick={() => setDayViewDate(null)}
              className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
            >
              ✕ Luk
            </button>
          </div>

          {dayLoading ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <p className="text-sm text-gray-400">Henter bookinger…</p>
            </div>
          ) : (
            <div className="min-h-[500px]">
              <DayScheduleGrid
                date={dayViewDate}
                barbers={activeBarbers.map((b) => ({
                  id: b.id,
                  display_name: b.display_name,
                  profile_color: b.profile_color,
                }))}
                bookings={dayBookings.map((b) => ({
                  id: b.id,
                  starts_at: b.starts_at,
                  ends_at: b.ends_at,
                  duration_minutes: b.duration_minutes,
                  status: b.status,
                  source: b.source,
                  barber_id: b.barber_id,
                  customer: { id: b.customer.id, full_name: b.customer.full_name },
                  service: { name_da: b.service.name_da },
                  klipNote: b.klipNote ?? null,
                }))}
                barberHours={dayBarberHours}
                onBookingClick={(scheduleBooking) => {
                  // Look up the full DayBooking to populate the Administrér modal
                  const full = dayBookings.find((b) => b.id === scheduleBooking.id)
                  if (full) setManageBooking(full)
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Manage booking modal */}
      {manageBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-lg border border-gray-200 w-full max-w-md overflow-hidden shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="text-sm font-medium text-gray-900">
                Booking — {manageBooking.customer.full_name}
              </h3>
              <button
                onClick={closeManageModal}
                className="text-gray-400 hover:text-gray-700 transition-colors"
                aria-label="Luk"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Booking details */}
            <div className="px-5 py-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Ydelse</span>
                <span className="text-gray-900">{manageBooking.service.name_da}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Frisør</span>
                <span className="text-gray-900">{manageBooking.barber.display_name}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">Tid</span>
                <button
                  onClick={() => setShowReschedule(true)}
                  className="border border-[#B08A3E] text-[#B08A3E] hover:bg-[#B08A3E] hover:text-white text-xs px-3 py-1 rounded transition-colors"
                >
                  Skift tid
                </button>
                <span className="flex-1" />
                <span className="text-gray-900">
                  {new Date(manageBooking.starts_at).toLocaleTimeString('da-DK', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {' — '}
                  {new Date(manageBooking.ends_at).toLocaleTimeString('da-DK', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <span className="text-gray-900 capitalize">{manageBooking.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Telefon</span>
                <a
                  href={`tel:${manageBooking.customer.phone_e164}`}
                  className="text-[#B08A3E]"
                >
                  {manageBooking.customer.phone_e164}
                </a>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-500 flex-shrink-0">Note</span>
                <span
                  className={`text-right ${
                    manageBooking.klipNote?.body ? 'text-gray-900' : 'text-gray-400'
                  }`}
                  title={manageBooking.klipNote?.body || undefined}
                >
                  {manageBooking.klipNote?.body
                    ? manageBooking.klipNote.body.length > 80
                      ? `${manageBooking.klipNote.body.slice(0, 80)}…`
                      : manageBooking.klipNote.body
                    : '—'}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="px-5 py-4 border-t border-gray-200 space-y-2">
              {completingMode ? (
                <div className="space-y-3">
                  <textarea
                    value={completionNote}
                    onChange={(e) => setCompletionNote(e.target.value)}
                    placeholder="Hvad blev lavet i dag?"
                    rows={3}
                    autoFocus
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#B08A3E] transition-colors resize-none"
                  />
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleSaveAndComplete}
                      disabled={actionLoading}
                      className="bg-[#B08A3E] hover:bg-[#8C6A28] text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {actionLoading ? 'Gemmer…' : 'Gem og fuldfør'}
                    </button>
                    <button
                      onClick={() => {
                        setCompletingMode(false)
                        setCompletionNote('')
                      }}
                      disabled={actionLoading}
                      className="text-xs text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
                    >
                      Annullér
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {manageBooking.status === 'confirmed' && (
                    <>
                      <button
                        onClick={() => setCompletingMode(true)}
                        disabled={actionLoading}
                        className="w-full py-2.5 bg-[#B08A3E] hover:bg-[#8C6A28] text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                      >
                        Markér som fuldført
                      </button>
                      <button
                        onClick={async () => {
                          const id = manageBooking.id
                          const day = dayViewDate
                          setActionLoading(true)
                          await supabase.from('bookings').update({ status: 'no_show' }).eq('id', id)
                          closeManageModal()
                          setActionLoading(false)
                          refreshMonth()
                          if (day) handleDayClick(day)
                        }}
                        disabled={actionLoading}
                        className="w-full py-2.5 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                      >
                        Udeblevet
                      </button>
                    </>
                  )}
                  <button
                    onClick={async () => {
                      if (!confirm('Er du sikker på at du vil afbestille denne booking?')) return
                      const id = manageBooking.id
                      const day = dayViewDate
                      setActionLoading(true)
                      await supabase
                        .from('bookings')
                        .update({
                          status: 'cancelled',
                          cancelled_at: new Date().toISOString(),
                          cancelled_by: 'admin',
                        })
                        .eq('id', id)
                      closeManageModal()
                      setActionLoading(false)
                      refreshMonth()
                      if (day) handleDayClick(day)
                    }}
                    disabled={actionLoading}
                    className="w-full py-2.5 border border-gray-200 text-gray-500 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Afbestil booking
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reschedule modal — overlays on top of the Administrér modal */}
      {showReschedule && manageBooking && (
        <RescheduleModal
          booking={{
            id: manageBooking.id,
            barber_id: manageBooking.barber_id,
            service_id: manageBooking.service_id,
            starts_at: manageBooking.starts_at,
            ends_at: manageBooking.ends_at,
            customer_name: manageBooking.customer.full_name,
            service_name: manageBooking.service.name_da,
            barber_name: manageBooking.barber.display_name,
          }}
          onClose={() => setShowReschedule(false)}
          onRescheduled={() => {
            const day = dayViewDate
            setShowReschedule(false)
            setManageBooking(null)
            refreshMonth()
            if (day) handleDayClick(day)
          }}
        />
      )}
    </div>
  )
}
