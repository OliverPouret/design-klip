import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { isoDate, isoWeekday } from '../../lib/danishDates'
import { Card } from '../../components/admin/Card'

const MONTH_FULL = [
  'januar', 'februar', 'marts', 'april', 'maj', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'december',
]
const WEEKDAY_HEADERS = ['M', 'T', 'O', 'T', 'F', 'L', 'S']

export function CalendarPage() {
  const navigate = useNavigate()
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

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

  const handleDayClick = (d: Date) => {
    sessionStorage.setItem('admin_view_date', isoDate(d))
    navigate('/admin/i-dag')
  }

  return (
    <div className="md:h-full md:flex md:flex-col md:gap-3 md:min-h-0">
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
      <div className="md:flex-1 md:min-h-0 grid grid-cols-1 md:grid-cols-[1fr_240px] gap-3">
        {/* Calendar grid */}
        <Card padding="sm" className="md:flex md:flex-col md:min-h-0">
          <div className="grid grid-cols-7 mb-2 flex-shrink-0">
            {WEEKDAY_HEADERS.map((d, i) => (
              <div
                key={i}
                className="text-center py-1.5 text-[11px] font-semibold tracking-[0.08em] uppercase text-gray-400"
              >
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 grid-rows-6 gap-1 md:flex-1 md:min-h-0">
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
                  className={`min-h-0 rounded-md text-left p-1.5 border border-gray-200 transition-colors flex flex-col ${
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
    </div>
  )
}
