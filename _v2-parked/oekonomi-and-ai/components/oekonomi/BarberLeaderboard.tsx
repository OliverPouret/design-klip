import { useMemo, useState } from 'react'
import { formatDKK, avgTicket, getIsoWeekday } from '../../../utils/revenueUtils'
import type { BookingForKPI } from './KPITileRow'
import type { Barber } from '../../../types/database'

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

type SortKey = 'name' | 'revenue' | 'count' | 'avg' | 'occupancy' | 'noShows'

interface BarberLeaderboardProps {
  barbers: Barber[]
  bookings: BookingForKPI[]
  hours: BarberHourRow[]
  timeOff: TimeOffRow[]
  start: Date
  end: Date
}

interface BarberRow {
  id: string
  name: string
  revenue: number
  count: number
  avg: number
  occupancy: number
  noShows: number
}

function timeStrToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m ?? 0)
}

function workingMinutesForBarber(
  barberId: string,
  start: Date,
  end: Date,
  hours: BarberHourRow[],
  timeOff: TimeOffRow[],
): number {
  const map = new Map<number, BarberHourRow>()
  for (const h of hours.filter((x) => x.barber_id === barberId)) map.set(h.isoweekday, h)
  let total = 0
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const stop = new Date(end.getFullYear(), end.getMonth(), end.getDate())
  while (cur.getTime() <= stop.getTime()) {
    const wd = getIsoWeekday(cur)
    const h = map.get(wd)
    if (h?.opens_at && h?.closes_at) {
      const dayStart = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), 0, 0, 0)
      const dayEnd = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), 23, 59, 59)
      const off = timeOff.some(
        (t) =>
          (t.barber_id === barberId || t.barber_id === null) &&
          t.is_all_day &&
          new Date(t.starts_at).getTime() <= dayEnd.getTime() &&
          new Date(t.ends_at).getTime() >= dayStart.getTime(),
      )
      if (!off) {
        total += timeStrToMinutes(h.closes_at) - timeStrToMinutes(h.opens_at)
      }
    }
    cur.setDate(cur.getDate() + 1)
  }
  return total
}

export function BarberLeaderboard({
  barbers,
  bookings,
  hours,
  timeOff,
  start,
  end,
}: BarberLeaderboardProps) {
  const [sortKey, setSortKey] = useState<SortKey>('revenue')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const rows = useMemo<BarberRow[]>(() => {
    return barbers.map((b) => {
      const theirBookings = bookings.filter((bk) => bk.barber_id === b.id)
      const revenueBookings = theirBookings.filter((bk) =>
        ['confirmed', 'completed'].includes(bk.status),
      )
      const revenue = revenueBookings.reduce((s, bk) => s + (bk.price_ore ?? 0), 0)
      const count = theirBookings.filter((bk) => bk.status !== 'cancelled').length
      const bookedMins = theirBookings
        .filter((bk) => bk.status !== 'cancelled')
        .reduce((s, bk) => s + (bk.services?.duration_minutes ?? 0), 0)
      const workingMins = workingMinutesForBarber(b.id, start, end, hours, timeOff)
      const occupancy = workingMins > 0 ? (bookedMins / workingMins) * 100 : 0
      const noShows = theirBookings.filter((bk) => bk.status === 'no_show').length
      return {
        id: b.id,
        name: b.display_name,
        revenue,
        count,
        avg: avgTicket(revenue, count),
        occupancy,
        noShows,
      }
    })
  }, [barbers, bookings, hours, timeOff, start, end])

  const sorted = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) => {
      let av: number | string = a[sortKey]
      let bv: number | string = b[sortKey]
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      }
      const an = av as number
      const bn = bv as number
      return sortDir === 'asc' ? an - bn : bn - an
    })
    return copy
  }, [rows, sortKey, sortDir])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'name' ? 'asc' : 'desc')
    }
  }

  const headers: { key: SortKey; label: string; align: 'left' | 'right' }[] = [
    { key: 'name', label: 'Frisør', align: 'left' },
    { key: 'revenue', label: 'Omsætning', align: 'right' },
    { key: 'count', label: 'Antal klip', align: 'right' },
    { key: 'avg', label: 'Gns. pris', align: 'right' },
    { key: 'occupancy', label: 'Belægning', align: 'right' },
    { key: 'noShows', label: 'Udeblivelser', align: 'right' },
  ]

  return (
    <div id="section-barbers">
      <h2 className="text-sm font-medium text-gray-900 mb-3">Frisører — performance</h2>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {headers.map((h) => (
                  <th
                    key={h.key}
                    onClick={() => handleSort(h.key)}
                    className={`px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-gray-500 cursor-pointer select-none hover:text-gray-700 ${
                      h.align === 'right' ? 'text-right' : 'text-left'
                    }`}
                  >
                    {h.label}
                    {sortKey === h.key && (
                      <span className="ml-1 text-[#B08A3E]">{sortDir === 'desc' ? '↓' : '↑'}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => (
                <tr
                  key={r.id}
                  className={`border-b border-gray-100 last:border-0 ${
                    i === 0 && sortKey === 'revenue' && sortDir === 'desc' ? 'bg-[#B08A3E]/5' : ''
                  }`}
                >
                  <td className="px-4 py-3 text-gray-900 font-medium">{r.name}</td>
                  <td className="px-4 py-3 text-right text-gray-900 tabular-nums">{formatDKK(r.revenue)}</td>
                  <td className="px-4 py-3 text-right text-gray-700 tabular-nums">{r.count}</td>
                  <td className="px-4 py-3 text-right text-gray-700 tabular-nums">{formatDKK(r.avg)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 bg-gray-100 rounded overflow-hidden">
                        <div
                          className="h-full bg-[#B08A3E]"
                          style={{ width: `${Math.min(100, Math.round(r.occupancy))}%` }}
                        />
                      </div>
                      <span className="tabular-nums text-gray-700 w-10 text-right">{Math.round(r.occupancy)}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700 tabular-nums">{r.noShows}</td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-400 italic">
                    Ingen frisører at vise
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
