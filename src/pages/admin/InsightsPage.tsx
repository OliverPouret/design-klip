import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useBarbers } from '../../hooks/useBarbers'
import { calcDelta, formatDKK } from '../../utils/revenueUtils'
import { EmptyState } from '../../components/admin/EmptyState'
import {
  OverblikHeader,
  type RangeKey,
} from '../../components/admin/overblik/OverblikHeader'
import { KPICard } from '../../components/admin/overblik/KPICard'
import {
  RevenueChart,
  type RevenueDayRow,
} from '../../components/admin/overblik/RevenueChart'
import { BarbersComparisonCard } from '../../components/admin/overblik/BarbersComparisonCard'
import { RecentBookingsList } from '../../components/admin/overblik/RecentBookingsList'

interface KpiRow {
  bookings_count: number
  revenue_ore: number
  avg_ticket_ore: number
  booked_minutes: number
  available_minutes: number
  prev_bookings_count: number
  prev_revenue_ore: number
  prev_avg_ticket_ore: number
}

interface BusiestBarberRow {
  barber_id: string
  display_name: string
  profile_color: string | null
  bookings_count: number
}

interface TopServiceRow {
  service_id: string
  name_da: string
  bookings_count: number
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function resolveRange(key: RangeKey): { start: string; end: string } {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  if (key === 'today') {
    return { start: isoDate(today), end: isoDate(today) }
  }
  if (key === 'week') {
    const dow = today.getDay() === 0 ? 7 : today.getDay()
    const monday = new Date(today)
    monday.setDate(today.getDate() - (dow - 1))
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    return { start: isoDate(monday), end: isoDate(sunday) }
  }
  if (key === 'month') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1)
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    return { start: isoDate(start), end: isoDate(end) }
  }
  if (key === 'last30') {
    const start = new Date(today)
    start.setDate(today.getDate() - 29)
    return { start: isoDate(start), end: isoDate(today) }
  }
  // last90
  const start = new Date(today)
  start.setDate(today.getDate() - 89)
  return { start: isoDate(start), end: isoDate(today) }
}

function rangeLabel(key: RangeKey): string {
  switch (key) {
    case 'today':
      return 'i dag'
    case 'week':
      return 'denne uge'
    case 'month':
      return 'denne måned'
    case 'last30':
      return 'sidste 30 dage'
    case 'last90':
      return 'sidste 90 dage'
  }
}

function formatHours(minutes: number): number {
  return Math.round(minutes / 60)
}

const ICON_SCISSORS_LARGE = (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="6" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <line x1="20" y1="4" x2="8.12" y2="15.88" />
    <line x1="14.47" y1="14.48" x2="20" y2="20" />
    <line x1="8.12" y1="8.12" x2="12" y2="12" />
  </svg>
)

export function InsightsPage() {
  const { barbers } = useBarbers()
  const [dateRange, setDateRange] = useState<RangeKey>('week')
  const [barberId, setBarberId] = useState<string | null>(null)

  const [kpis, setKpis] = useState<KpiRow | null>(null)
  const [revenueByDay, setRevenueByDay] = useState<RevenueDayRow[]>([])
  const [busiestBarbers, setBusiestBarbers] = useState<BusiestBarberRow[]>([])
  const [topServices, setTopServices] = useState<TopServiceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Page-level empty state: cheap head-only count to know whether the shop
  // has any bookings at all (vs. just none in the current range).
  const [shopHasBookings, setShopHasBookings] = useState<boolean | null>(null)

  useEffect(() => {
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .then(({ count, error: err }) => {
        if (err) {
          setShopHasBookings(true)
          return
        }
        setShopHasBookings((count ?? 0) > 0)
      })
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const { start, end } = resolveRange(dateRange)
    // The chart fetches up to the past 90 days regardless of page-level
    // range so the in-card 7/30/90 toggle has data to slice from.
    const chartStartDate = (() => {
      const d = new Date()
      d.setDate(d.getDate() - 89)
      return isoDate(new Date(d.getFullYear(), d.getMonth(), d.getDate()))
    })()
    const chartEndDate = isoDate(new Date())

    Promise.all([
      supabase.rpc('get_overview_kpis', {
        p_start_date: start,
        p_end_date: end,
        p_barber_id: barberId,
      }),
      supabase.rpc('get_revenue_by_day', {
        p_start_date: chartStartDate,
        p_end_date: chartEndDate,
        p_barber_id: barberId,
      }),
      supabase.rpc('get_busiest_barbers', {
        p_start_date: start,
        p_end_date: end,
      }),
      supabase.rpc('get_top_services', {
        p_start_date: start,
        p_end_date: end,
        p_barber_id: barberId,
        p_limit: 3,
      }),
    ])
      .then(([kpisRes, revRes, barbersRes, servicesRes]) => {
        if (cancelled) return
        const firstErr =
          kpisRes.error ?? revRes.error ?? barbersRes.error ?? servicesRes.error
        if (firstErr) {
          console.error('Overblik load failed:', firstErr)
          setError('Kunne ikke indlæse data.')
          setLoading(false)
          return
        }
        const kpiRow = (kpisRes.data?.[0] ?? null) as KpiRow | null
        setKpis(kpiRow)
        setRevenueByDay((revRes.data ?? []) as RevenueDayRow[])
        setBusiestBarbers((barbersRes.data ?? []) as BusiestBarberRow[])
        setTopServices((servicesRes.data ?? []) as TopServiceRow[])
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('Overblik load failed:', err)
        setError('Kunne ikke indlæse data.')
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [dateRange, barberId])

  const sparklineData = useMemo(() => {
    const { start, end } = resolveRange(dateRange)
    return revenueByDay
      .filter((r) => r.day >= start && r.day <= end)
      .map((r) => ({ day: r.day, value: r.revenue_ore }))
  }, [revenueByDay, dateRange])

  // Chart slices to the page-level window; the chart still owns its 7/30/90
  // toggle for narrowing further.
  const chartData = useMemo(() => {
    const { start, end } = resolveRange(dateRange)
    return revenueByDay.filter((r) => r.day >= start && r.day <= end)
  }, [revenueByDay, dateRange])

  if (shopHasBookings === false) {
    return (
      <div className="md:h-full md:overflow-y-auto md:pr-1 pt-6">
        <EmptyState
          title="Velkommen til Overblik"
          body="Når dine kunder begynder at booke, ser du dine tal her — bookinger, omsætning og dine travleste tider."
          action={{ label: 'Opret første booking', to: '/admin/opret-booking' }}
          icon={ICON_SCISSORS_LARGE}
        />
      </div>
    )
  }

  const bookingsTrend = kpis
    ? calcDelta(kpis.bookings_count, kpis.prev_bookings_count)
    : undefined
  const avgTrend = kpis
    ? calcDelta(kpis.avg_ticket_ore, kpis.prev_avg_ticket_ore)
    : undefined

  const barbersForCard = busiestBarbers.map((b) => ({
    id: b.barber_id,
    label: b.display_name,
    sublabel: 'Frisør',
    count: b.bookings_count,
    avatarColor: b.profile_color ?? '#B08A3E',
  }))

  const servicesForCard = topServices.map((s) => ({
    id: s.service_id,
    label: s.name_da,
    count: s.bookings_count,
  }))

  const filteredBarberName = barberId
    ? (barbers.find((b) => b.id === barberId)?.display_name ?? null)
    : null
  const topServicesTitle = filteredBarberName
    ? `Mest bookede services hos ${filteredBarberName}`
    : 'Mest bookede services'

  return (
    <div className="md:h-full md:flex md:flex-col md:min-h-0 md:overflow-y-auto md:pr-1 space-y-6">
      <OverblikHeader
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        barberId={barberId}
        onBarberChange={setBarberId}
        barbers={barbers}
      />

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-4 py-2">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Bookinger"
          value={kpis?.bookings_count ?? 0}
          suffix={(kpis?.bookings_count ?? 0) === 1 ? 'booking' : 'bookinger'}
          trend={bookingsTrend}
          loading={loading}
        />
        <KPICard
          label="Omsætning"
          value={kpis ? formatDKK(kpis.revenue_ore).replace(' kr', '') : '0'}
          suffix="kr"
          variant="sparkline"
          sparkline={sparklineData}
          loading={loading}
        />
        <KPICard
          label="Snit pr. booking"
          value={kpis ? formatDKK(kpis.avg_ticket_ore).replace(' kr', '') : '0'}
          suffix="kr"
          trend={avgTrend}
          loading={loading}
        />
        <KPICard
          label="Bookede timer"
          value={formatHours(kpis?.booked_minutes ?? 0)}
          variant="fraction"
          fractionDenominator={formatHours(kpis?.available_minutes ?? 0)}
          suffix="timer"
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <RevenueChart data={chartData} loading={loading} />
        </div>
        <div className="space-y-4">
          <BarbersComparisonCard
            title="Travleste barberer"
            items={barbersForCard}
            countSuffix={(barbersForCard[0]?.count ?? 0) === 1 ? 'booking' : 'bookinger'}
            barColor="#5C7A4A"
            loading={loading}
            emptyText={`Ingen bookinger ${rangeLabel(dateRange)}.`}
          />
          <BarbersComparisonCard
            title={topServicesTitle}
            items={servicesForCard}
            countSuffix={(servicesForCard[0]?.count ?? 0) === 1 ? 'booking' : 'bookinger'}
            barColor="#B08A3E"
            loading={loading}
            emptyText="Ingen services bookede i denne periode."
          />
        </div>
      </div>

      <RecentBookingsList limit={5} />
    </div>
  )
}
