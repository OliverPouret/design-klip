import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { Card } from '../Card'
import { formatDKK, getIsoWeekday } from '../../../utils/revenueUtils'

interface ForecastBooking {
  starts_at: string
  status: string
  price_ore: number
  barber_id: string | null
  services?: { duration_minutes: number } | null
}

interface BarberHourRow {
  barber_id: string
  isoweekday: number
  opens_at: string | null
  closes_at: string | null
}

const FORECAST_LOOKBACK_DAYS = 90

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0)
}
function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
}
function endOfWeekSunday(today: Date): Date {
  const day = today.getDay()
  const diff = day === 0 ? 0 : 7 - day
  return endOfDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() + diff))
}
function endOfMonth(today: Date): Date {
  return endOfDay(new Date(today.getFullYear(), today.getMonth() + 1, 0))
}
function timeStrToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m ?? 0)
}

interface ForecastBucket {
  bekraeftet: number
  forventet: number
}

function bookedRevenue(bs: ForecastBooking[], from: Date, to: Date): number {
  return bs
    .filter((b) => {
      const t = new Date(b.starts_at).getTime()
      return (
        t >= from.getTime() &&
        t <= to.getTime() &&
        ['confirmed', 'completed', 'pending'].includes(b.status)
      )
    })
    .reduce((s, b) => s + (b.price_ore ?? 0), 0)
}

function bookedDayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function predictForecast(
  history: ForecastBooking[],
  hours: BarberHourRow[],
  bookedFuture: ForecastBooking[],
  windowStart: Date,
  windowEnd: Date,
  activeBarberIds: string[],
): { forventet: number; weeksOfData: number } {
  const now = new Date()
  const lookbackStart = new Date(now)
  lookbackStart.setDate(lookbackStart.getDate() - FORECAST_LOOKBACK_DAYS)

  const historicalCompleted = history.filter(
    (b) =>
      b.status === 'completed' &&
      new Date(b.starts_at).getTime() >= lookbackStart.getTime() &&
      new Date(b.starts_at).getTime() <= now.getTime(),
  )

  const earliest = historicalCompleted.reduce<Date | null>((acc, b) => {
    const t = new Date(b.starts_at)
    if (!acc || t.getTime() < acc.getTime()) return t
    return acc
  }, null)
  const weeksOfData = earliest
    ? Math.floor((now.getTime() - earliest.getTime()) / (7 * 24 * 60 * 60 * 1000))
    : 0

  // Average revenue per weekday across the lookback window
  const sumByWd: number[] = [0, 0, 0, 0, 0, 0, 0, 0]
  const countByWd: number[] = [0, 0, 0, 0, 0, 0, 0, 0]
  const seenDays = new Map<string, number>()
  for (const b of historicalCompleted) {
    const d = new Date(b.starts_at)
    const wd = getIsoWeekday(d)
    sumByWd[wd] += b.price_ore ?? 0
    const k = bookedDayKey(d)
    if (!seenDays.has(k)) {
      seenDays.set(k, wd)
      countByWd[wd] += 1
    }
  }
  const avgByWd: number[] = sumByWd.map((s, i) => (countByWd[i] > 0 ? s / countByWd[i] : 0))

  // Working minutes for a given date based on currently configured hours
  const hoursMap = new Map<string, BarberHourRow>()
  for (const h of hours) hoursMap.set(`${h.barber_id}-${h.isoweekday}`, h)
  const workingMinutesForDate = (d: Date): number => {
    const wd = getIsoWeekday(d)
    let m = 0
    for (const bid of activeBarberIds) {
      const h = hoursMap.get(`${bid}-${wd}`)
      if (h?.opens_at && h?.closes_at) {
        m += timeStrToMinutes(h.closes_at) - timeStrToMinutes(h.opens_at)
      }
    }
    return m
  }

  // Typical full-staffed working minutes for each weekday (max observed)
  const typicalWorkingByWd: number[] = [0, 0, 0, 0, 0, 0, 0, 0]
  for (let wd = 1; wd <= 7; wd++) {
    let max = 0
    for (const bid of activeBarberIds) {
      const h = hoursMap.get(`${bid}-${wd}`)
      if (h?.opens_at && h?.closes_at) {
        max += timeStrToMinutes(h.closes_at) - timeStrToMinutes(h.opens_at)
      }
    }
    typicalWorkingByWd[wd] = max
  }

  const futureBookedDays = new Set<string>()
  for (const b of bookedFuture) {
    const d = new Date(b.starts_at)
    if (
      d.getTime() >= windowStart.getTime() &&
      d.getTime() <= windowEnd.getTime() &&
      ['confirmed', 'pending', 'completed'].includes(b.status)
    ) {
      futureBookedDays.add(bookedDayKey(d))
    }
  }

  let forventet = 0
  const cur = new Date(windowStart.getFullYear(), windowStart.getMonth(), windowStart.getDate())
  while (cur.getTime() <= windowEnd.getTime()) {
    const key = bookedDayKey(cur)
    if (!futureBookedDays.has(key)) {
      const wd = getIsoWeekday(cur)
      const typical = typicalWorkingByWd[wd]
      const avail = workingMinutesForDate(cur)
      const ratio = typical > 0 ? Math.min(1, avail / typical) : 0
      forventet += avgByWd[wd] * ratio
    }
    cur.setDate(cur.getDate() + 1)
  }

  return { forventet: Math.round(forventet), weeksOfData }
}

export function ForecastSection({ activeBarberIds }: { activeBarberIds: string[] }) {
  const [history, setHistory] = useState<ForecastBooking[]>([])
  const [futureBooked, setFutureBooked] = useState<ForecastBooking[]>([])
  const [hours, setHours] = useState<BarberHourRow[]>([])
  const [last30, setLast30] = useState<number>(0)
  const [prev30, setPrev30] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const now = new Date()
    const lookbackStart = new Date(now)
    lookbackStart.setDate(lookbackStart.getDate() - FORECAST_LOOKBACK_DAYS)
    const horizon = endOfMonth(now)
    const last30Start = new Date(now)
    last30Start.setDate(last30Start.getDate() - 30)
    const prev30Start = new Date(now)
    prev30Start.setDate(prev30Start.getDate() - 60)

    Promise.all([
      supabase
        .from('bookings')
        .select('starts_at, status, price_ore, barber_id, services(duration_minutes)')
        .gte('starts_at', lookbackStart.toISOString())
        .lte('starts_at', horizon.toISOString())
        .order('starts_at'),
      supabase.from('barber_hours').select('barber_id, isoweekday, opens_at, closes_at'),
    ]).then(([bRes, hRes]) => {
      if (cancelled) return
      const all = (bRes.data ?? []) as unknown as ForecastBooking[]
      setHistory(all.filter((b) => new Date(b.starts_at).getTime() <= now.getTime()))
      setFutureBooked(all.filter((b) => new Date(b.starts_at).getTime() > now.getTime()))
      setHours((hRes.data ?? []) as BarberHourRow[])

      const sumRange = (from: Date, to: Date): number =>
        all
          .filter(
            (b) =>
              new Date(b.starts_at).getTime() >= from.getTime() &&
              new Date(b.starts_at).getTime() <= to.getTime() &&
              ['confirmed', 'completed'].includes(b.status),
          )
          .reduce((s, b) => s + (b.price_ore ?? 0), 0)
      setLast30(sumRange(last30Start, now))
      setPrev30(sumRange(prev30Start, last30Start))
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [])

  const buckets = useMemo<{ today: ForecastBucket; week: ForecastBucket; month: ForecastBucket; weeksOfData: number }>(() => {
    const now = new Date()
    const todayStart = startOfDay(now)
    const todayEnd = endOfDay(now)
    const weekEnd = endOfWeekSunday(now)
    const monthEnd = endOfMonth(now)
    const allBooked = [...history, ...futureBooked]

    const todayBek = bookedRevenue(allBooked, todayStart, todayEnd)
    const weekBek = bookedRevenue(allBooked, todayStart, weekEnd)
    const monthBek = bookedRevenue(allBooked, todayStart, monthEnd)

    const todayPred = predictForecast(history, hours, futureBooked, todayStart, todayEnd, activeBarberIds)
    const weekPred = predictForecast(history, hours, futureBooked, todayStart, weekEnd, activeBarberIds)
    const monthPred = predictForecast(history, hours, futureBooked, todayStart, monthEnd, activeBarberIds)

    return {
      today: { bekraeftet: todayBek, forventet: todayPred.forventet },
      week: { bekraeftet: weekBek, forventet: weekPred.forventet },
      month: { bekraeftet: monthBek, forventet: monthPred.forventet },
      weeksOfData: monthPred.weeksOfData,
    }
  }, [history, futureBooked, hours, activeBarberIds])

  if (loading) {
    return (
      <div>
        <h2 className="text-sm font-medium text-gray-900 mb-3">Prognose</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-lg p-4 h-[140px] animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (buckets.weeksOfData < 4) {
    return (
      <div>
        <h2 className="text-sm font-medium text-gray-900 mb-3">Prognose</h2>
        <Card padding="md">
          <p className="text-sm text-gray-500 italic">
            For lidt data til prognose endnu — kommer når der er 4+ uger med bookinger.
          </p>
        </Card>
      </div>
    )
  }

  const trendPct = prev30 > 0 ? Math.round(((last30 - prev30) / prev30) * 100) : 0
  const trendSign = trendPct > 0 ? '+' : ''
  const cards: { key: 'today' | 'week' | 'month'; label: string; data: ForecastBucket }[] = [
    { key: 'today', label: 'I DAG', data: buckets.today },
    { key: 'week', label: 'DENNE UGE', data: buckets.week },
    { key: 'month', label: 'DENNE MÅNED', data: buckets.month },
  ]

  return (
    <div>
      <h2 className="text-sm font-medium text-gray-900 mb-3">Prognose</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {cards.map((c) => {
          const total = c.data.bekraeftet + c.data.forventet
          return (
            <Card key={c.key} padding="md">
              <p className="text-[10px] tracking-[0.08em] uppercase text-gray-400 font-semibold">{c.label}</p>
              <p className="font-serif text-[24px] text-gray-900 leading-none mt-2">{formatDKK(c.data.bekraeftet)}</p>
              <p className="text-xs text-gray-500 mt-1">bekræftet</p>
              <p className="text-xs text-gray-500 mt-2">+ {formatDKK(c.data.forventet)} forventet</p>
              <div className="my-3 border-t border-gray-100" />
              <p className="text-sm font-medium text-[#B08A3E]">{formatDKK(total)} i alt</p>
            </Card>
          )
        })}
      </div>
      <p className="text-xs text-gray-400 italic mt-2">
        Prognose baseret på {buckets.weeksOfData} uger med data. Trend: {trendSign}
        {trendPct}% vs forrige måned.
      </p>
    </div>
  )
}
