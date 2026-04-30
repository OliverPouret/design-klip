import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useDateRange } from '../../hooks/useDateRange'
import { useBarbers } from '../../hooks/useBarbers'
import { FilterBar } from '../../components/admin/oekonomi/FilterBar'
import { KPITileRow } from '../../components/admin/oekonomi/KPITileRow'
import type { BookingForKPI } from '../../components/admin/oekonomi/KPITileRow'
import { ForecastSection } from '../../components/admin/oekonomi/ForecastSection'
import { RevenueChart } from '../../components/admin/oekonomi/RevenueChart'
import { BarberLeaderboard } from '../../components/admin/oekonomi/BarberLeaderboard'
import { ServiceBreakdown } from '../../components/admin/oekonomi/ServiceBreakdown'
import { PaymentMethodSplit } from '../../components/admin/oekonomi/PaymentMethodSplit'
import { getIsoWeekday } from '../../utils/revenueUtils'

interface BarberHourRow {
  barber_id: string
  isoweekday: number
  opens_at: string | null
  closes_at: string | null
}

interface TimeOffRow {
  barber_id: string | null
  starts_at: string
  ends_at: string
  is_all_day: boolean
}

function timeStrToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m ?? 0)
}

function calculateWorkingMinutes(
  start: Date,
  end: Date,
  barberIds: string[],
  hours: BarberHourRow[],
  timeOff: TimeOffRow[],
): number {
  if (barberIds.length === 0) return 0
  const hoursByBarberDay = new Map<string, BarberHourRow>()
  for (const h of hours) {
    hoursByBarberDay.set(`${h.barber_id}-${h.isoweekday}`, h)
  }

  let total = 0
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const lastDay = new Date(end.getFullYear(), end.getMonth(), end.getDate())

  while (cursor.getTime() <= lastDay.getTime()) {
    const wd = getIsoWeekday(cursor)
    const dayStart = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), 0, 0, 0)
    const dayEnd = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), 23, 59, 59)

    for (const bid of barberIds) {
      const h = hoursByBarberDay.get(`${bid}-${wd}`)
      if (!h || !h.opens_at || !h.closes_at) continue
      const minutes = timeStrToMinutes(h.closes_at) - timeStrToMinutes(h.opens_at)
      // subtract any all-day time off that covers this day
      const offThisDay = timeOff.some(
        (t) =>
          (t.barber_id === bid || t.barber_id === null) &&
          new Date(t.starts_at).getTime() <= dayEnd.getTime() &&
          new Date(t.ends_at).getTime() >= dayStart.getTime() &&
          t.is_all_day,
      )
      if (offThisDay) continue
      total += minutes
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return total
}

export function OekonomiPage() {
  const { state, setPreset, setCustomRange, setComparison } = useDateRange()
  const { barbers } = useBarbers()

  const [currentBookings, setCurrentBookings] = useState<BookingForKPI[]>([])
  const [comparisonBookings, setComparisonBookings] = useState<BookingForKPI[]>([])
  const [barberHours, setBarberHours] = useState<BarberHourRow[]>([])
  const [timeOff, setTimeOff] = useState<TimeOffRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    const select =
      'id, price_ore, status, source, starts_at, ends_at, barber_id, service_id, customer_id, services(name_da, duration_minutes)'

    Promise.all([
      supabase
        .from('bookings')
        .select(select)
        .gte('starts_at', state.start.toISOString())
        .lte('starts_at', state.end.toISOString())
        .order('starts_at'),
      supabase
        .from('bookings')
        .select(select)
        .gte('starts_at', state.comparisonStart.toISOString())
        .lte('starts_at', state.comparisonEnd.toISOString())
        .order('starts_at'),
      supabase.from('barber_hours').select('barber_id, isoweekday, opens_at, closes_at'),
      supabase
        .from('time_off')
        .select('barber_id, starts_at, ends_at, is_all_day')
        .lte('starts_at', state.end.toISOString())
        .gte('ends_at', state.comparisonStart.toISOString()),
    ]).then(([curRes, cmpRes, hoursRes, offRes]) => {
      if (cancelled) return
      setCurrentBookings((curRes.data ?? []) as unknown as BookingForKPI[])
      setComparisonBookings((cmpRes.data ?? []) as unknown as BookingForKPI[])
      setBarberHours((hoursRes.data ?? []) as BarberHourRow[])
      setTimeOff((offRes.data ?? []) as TimeOffRow[])
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [state.start, state.end, state.comparisonStart, state.comparisonEnd])

  const activeBarberIds = useMemo(() => barbers.map((b) => b.id), [barbers])

  const workingMinutes = useMemo(
    () => calculateWorkingMinutes(state.start, state.end, activeBarberIds, barberHours, timeOff),
    [state.start, state.end, activeBarberIds, barberHours, timeOff],
  )
  const comparisonWorkingMinutes = useMemo(
    () =>
      calculateWorkingMinutes(
        state.comparisonStart,
        state.comparisonEnd,
        activeBarberIds,
        barberHours,
        timeOff,
      ),
    [state.comparisonStart, state.comparisonEnd, activeBarberIds, barberHours, timeOff],
  )

  const handleTileClick = (target: 'revenue' | 'avg' | 'count' | 'occupancy' | 'noShows') => {
    const id = target === 'revenue'
      ? 'section-chart'
      : target === 'count' || target === 'occupancy' || target === 'avg'
      ? 'section-barbers'
      : 'section-missed'
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="md:h-full md:overflow-y-auto md:pr-1 space-y-8">
      <div>
        <h1 className="font-serif text-[28px] text-gray-900 leading-tight">Økonomi</h1>
        <p className="text-sm text-gray-500 mt-1">Komplet finansielt overblik for Design Klip</p>
      </div>

      <FilterBar
        preset={state.preset}
        start={state.start}
        end={state.end}
        comparison={state.comparison}
        onPresetChange={setPreset}
        onCustomRange={setCustomRange}
        onComparisonChange={setComparison}
      />

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-lg p-4 h-[100px] animate-pulse" />
          ))}
        </div>
      ) : (
        <KPITileRow
          current={currentBookings}
          comparison={comparisonBookings}
          comparisonMode={state.comparison}
          workingMinutes={workingMinutes}
          comparisonWorkingMinutes={comparisonWorkingMinutes}
          onTileClick={handleTileClick}
        />
      )}

      <ForecastSection activeBarberIds={activeBarberIds} />

      {!loading && (
        <>
          <RevenueChart
            current={currentBookings}
            comparison={comparisonBookings}
            comparisonMode={state.comparison}
            start={state.start}
            end={state.end}
            hours={barberHours}
            activeBarberIds={activeBarberIds}
          />

          <BarberLeaderboard
            barbers={barbers}
            bookings={currentBookings}
            hours={barberHours}
            timeOff={timeOff}
            start={state.start}
            end={state.end}
          />

          <ServiceBreakdown bookings={currentBookings} />

          <PaymentMethodSplit bookings={currentBookings} />
        </>
      )}
    </div>
  )
}
