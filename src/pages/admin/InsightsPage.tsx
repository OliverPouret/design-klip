import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatDKK } from '../../utils/revenueUtils'

interface BookingStats {
  count: number
  revenueOre: number
}

interface OverviewData {
  bookings: {
    today: number
    week: number
    month: number
  }
  missed: {
    noShows: number
    cancelled: number
  }
  economy: {
    total: BookingStats
    today: BookingStats
    week: BookingStats
    month: BookingStats
    threeMonths: BookingStats
    year: BookingStats
  }
}

interface BookingRow {
  id: string
  price_ore: number | null
  status: string
  starts_at: string
}

const ACTIVE_STATUSES = ['confirmed', 'completed', 'pending']

function inRange(b: BookingRow, start: Date, end: Date): boolean {
  const ts = new Date(b.starts_at).getTime()
  return ts >= start.getTime() && ts <= end.getTime()
}

function bucket(bookings: BookingRow[], start: Date, end: Date): BookingStats {
  let count = 0
  let revenueOre = 0
  for (const b of bookings) {
    if (ACTIVE_STATUSES.includes(b.status) && inRange(b, start, end)) {
      count++
      revenueOre += b.price_ore || 0
    }
  }
  return { count, revenueOre }
}

export function InsightsPage() {
  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const now = new Date()

        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

        const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay()
        const weekStart = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() - (dayOfWeek - 1),
          0,
          0,
          0,
        )
        const weekEnd = new Date(
          weekStart.getFullYear(),
          weekStart.getMonth(),
          weekStart.getDate() + 6,
          23,
          59,
          59,
        )

        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0)
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

        const threeMonthsStart = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() - 90,
          0,
          0,
          0,
        )

        const yearStart = new Date(now.getFullYear(), 0, 1, 0, 0, 0)
        const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59)

        const { data: rows, error: dbErr } = await supabase
          .from('bookings')
          .select('id, price_ore, status, starts_at')

        if (cancelled) return
        if (dbErr) throw dbErr

        const bookings = ((rows as BookingRow[] | null) ?? [])

        const bookingsCount = (start: Date, end: Date) =>
          bookings.filter(
            (b) => ACTIVE_STATUSES.includes(b.status) && inRange(b, start, end),
          ).length

        const noShowsThisMonth = bookings.filter(
          (b) => b.status === 'no_show' && inRange(b, monthStart, monthEnd),
        ).length
        const cancelledThisMonth = bookings.filter(
          (b) => b.status === 'cancelled' && inRange(b, monthStart, monthEnd),
        ).length

        const completed = bookings.filter((b) => b.status === 'completed')
        const total: BookingStats = {
          count: completed.length,
          revenueOre: completed.reduce((sum, b) => sum + (b.price_ore || 0), 0),
        }

        setData({
          bookings: {
            today: bookingsCount(todayStart, todayEnd),
            week: bookingsCount(weekStart, weekEnd),
            month: bookingsCount(monthStart, monthEnd),
          },
          missed: {
            noShows: noShowsThisMonth,
            cancelled: cancelledThisMonth,
          },
          economy: {
            total,
            today: bucket(bookings, todayStart, todayEnd),
            week: bucket(bookings, weekStart, weekEnd),
            month: bucket(bookings, monthStart, monthEnd),
            threeMonths: bucket(bookings, threeMonthsStart, todayEnd),
            year: bucket(bookings, yearStart, yearEnd),
          },
        })
      } catch (err) {
        console.error('Failed to load Overblik:', err)
        if (!cancelled) setError('Kunne ikke indlæse data.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="md:h-full md:flex md:flex-col md:min-h-0 md:overflow-y-auto md:pr-1 space-y-6">
      <div className="flex-shrink-0">
        <h1 className="text-[22px] font-semibold text-ink">Overblik</h1>
        <p className="text-sm text-gray-500 mt-1">Forretningens nøgletal</p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Indlæser…</p>
      ) : error || !data ? (
        <p className="text-sm text-red-600">{error ?? 'Kunne ikke indlæse data.'}</p>
      ) : (
        <>
          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Bookinger</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <SimpleStatCard
                label="I dag"
                value={data.bookings.today}
                suffix={data.bookings.today === 1 ? 'booking' : 'bookinger'}
              />
              <SimpleStatCard
                label="Denne uge"
                value={data.bookings.week}
                suffix={data.bookings.week === 1 ? 'booking' : 'bookinger'}
              />
              <SimpleStatCard
                label="Denne måned"
                value={data.bookings.month}
                suffix={data.bookings.month === 1 ? 'booking' : 'bookinger'}
              />
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">
              Mistede bookinger denne måned
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SimpleStatCard
                label="Udeblivelser"
                value={data.missed.noShows}
                suffix={data.missed.noShows === 1 ? 'kunde' : 'kunder'}
              />
              <SimpleStatCard
                label="Aflyste"
                value={data.missed.cancelled}
                suffix={data.missed.cancelled === 1 ? 'booking' : 'bookinger'}
              />
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-1">Økonomi</h2>
            <p className="text-sm text-gray-500 italic mb-4">
              Tallene er vejledende og baseret på bookede tider. Faktisk omsætning kan afvige.
            </p>

            <div className="bg-white border border-gray-200 rounded-lg p-6 mb-4">
              <div className="text-[10px] tracking-[0.08em] uppercase text-gray-400 mb-2">
                I alt gennemført
              </div>
              <div className="text-3xl font-semibold text-gray-900">
                {data.economy.total.count}{' '}
                <span className="text-base text-gray-400 font-normal">
                  {data.economy.total.count === 1 ? 'booking' : 'bookinger'}
                </span>
              </div>
              <div className="text-xl text-[#B08A3E] mt-1">
                ~{formatDKK(data.economy.total.revenueOre)}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <PeriodCard label="I dag" stats={data.economy.today} />
              <PeriodCard label="Denne uge" stats={data.economy.week} />
              <PeriodCard label="Denne måned" stats={data.economy.month} />
              <PeriodCard label="Seneste 3 måneder" stats={data.economy.threeMonths} />
              <PeriodCard label="I år" stats={data.economy.year} />
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function SimpleStatCard({
  label,
  value,
  suffix,
}: {
  label: string
  value: number
  suffix: string
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <div className="text-[10px] tracking-[0.08em] uppercase text-gray-400 mb-2">{label}</div>
      <div className="text-2xl font-semibold text-gray-900">
        {value} <span className="text-base text-gray-400 font-normal">{suffix}</span>
      </div>
    </div>
  )
}

function PeriodCard({ label, stats }: { label: string; stats: BookingStats }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <div className="text-[10px] tracking-[0.08em] uppercase text-gray-400 mb-2">{label}</div>
      <div className="text-xl font-semibold text-gray-900">
        {stats.count}{' '}
        <span className="text-sm text-gray-400 font-normal">
          {stats.count === 1 ? 'booking' : 'bookinger'}
        </span>
      </div>
      <div className="text-base text-[#B08A3E] mt-1">~{formatDKK(stats.revenueOre)}</div>
    </div>
  )
}
