import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { isoDate, isoWeekday } from '../../lib/danishDates'
import { Card } from '../../components/admin/Card'

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
  customer: { id: string; full_name: string }
  service: { name_da: string }
  barber: { display_name: string; slug: string }
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
  const [dayLoading, setDayLoading] = useState(false)
  const dayPanelRef = useRef<HTMLDivElement>(null)

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
  }, [viewMonth])

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
        id, starts_at, ends_at, duration_minutes, status, source, barber_id,
        customer:customers!inner(id, full_name),
        service:services!inner(name_da),
        barber:barbers!inner(display_name, slug)
      `)
      .gte('starts_at', start.toISOString())
      .lt('starts_at', end.toISOString())
      .in('status', ['confirmed', 'pending', 'completed', 'no_show'])
      .order('starts_at')

    setDayBookings((data ?? []) as unknown as DayBooking[])
    setDayLoading(false)

    setTimeout(() => {
      dayPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

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
          <h1 className="font-serif text-[18px] text-gray-900 capitalize">
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
            <p className="font-serif text-[24px] text-gray-900 mt-1 leading-none">{totalBookings}</p>
          </Card>
          <Card padding="sm">
            <p className="text-[11px] tracking-[0.08em] uppercase text-gray-400 font-semibold">Aktive dage</p>
            <p className="font-serif text-[24px] text-gray-900 mt-1 leading-none">{activeDays}</p>
          </Card>
          <Card padding="sm">
            <p className="text-[11px] tracking-[0.08em] uppercase text-gray-400 font-semibold">Gns. pr. dag</p>
            <p className="font-serif text-[24px] text-gray-900 mt-1 leading-none">{avgPerDay}</p>
          </Card>
        </div>
      </div>

      {/* Day panel — appears when a day is clicked */}
      {dayViewDate && (
        <div ref={dayPanelRef} className="flex-shrink-0">
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
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
              <div className="p-8 text-center">
                <p className="text-sm text-gray-400">Henter bookinger…</p>
              </div>
            ) : dayBookings.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-gray-400">Ingen bookinger denne dag.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {dayBookings.map((b) => (
                  <div key={b.id} className="flex items-center justify-between px-5 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{b.customer.full_name}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {b.service.name_da} · {b.barber.display_name}
                        {b.source === 'phone' && ' · 📞'}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <p className="text-sm text-gray-700">
                        {new Date(b.starts_at).toLocaleTimeString('da-DK', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      <p className="text-xs text-gray-400">{b.duration_minutes} min</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
