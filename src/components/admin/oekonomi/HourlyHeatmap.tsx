import { useMemo, useState } from 'react'
import type { BookingForKPI } from './KPITileRow'
import { getIsoWeekday } from '../../../utils/revenueUtils'

interface BarberHourRow {
  barber_id: string
  isoweekday: number
  opens_at: string | null
  closes_at: string | null
}

interface HourlyHeatmapProps {
  bookings: BookingForKPI[]
  hours: BarberHourRow[]
}

const DAY_LABELS = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn']
const DAY_FULL = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag']

function timeStrToHour(t: string): number {
  return Number(t.split(':')[0])
}

export function HourlyHeatmap({ bookings, hours }: HourlyHeatmapProps) {
  const [hoverCell, setHoverCell] = useState<{ wd: number; hour: number; avg: number } | null>(null)

  const range = useMemo(() => {
    let earliest = 9
    let latest = 19
    if (hours.length > 0) {
      const opens = hours.filter((h) => h.opens_at).map((h) => timeStrToHour(h.opens_at!))
      const closes = hours.filter((h) => h.closes_at).map((h) => timeStrToHour(h.closes_at!))
      if (opens.length) earliest = Math.min(...opens)
      if (closes.length) latest = Math.max(...closes)
    }
    return { earliest, latest }
  }, [hours])

  const grid = useMemo(() => {
    // Map<weekday(1-7) -> Map<hour -> { count, days }>
    const counts: Record<number, Record<number, number>> = {}
    const dayKeysByWd: Record<number, Set<string>> = {}
    for (let wd = 1; wd <= 7; wd++) {
      counts[wd] = {}
      dayKeysByWd[wd] = new Set()
      for (let h = range.earliest; h < range.latest; h++) {
        counts[wd][h] = 0
      }
    }

    for (const b of bookings) {
      if (b.status === 'cancelled') continue
      const d = new Date(b.starts_at)
      const wd = getIsoWeekday(d)
      const hour = d.getHours()
      if (hour < range.earliest || hour >= range.latest) continue
      counts[wd][hour] = (counts[wd][hour] ?? 0) + 1
      const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      dayKeysByWd[wd].add(k)
    }

    // Average = count / number-of-distinct-days-of-that-weekday-with-bookings, fallback to 1
    const avgs: Record<number, Record<number, number>> = {}
    let max = 0
    for (let wd = 1; wd <= 7; wd++) {
      avgs[wd] = {}
      const dayCount = Math.max(1, dayKeysByWd[wd].size)
      for (let h = range.earliest; h < range.latest; h++) {
        const v = (counts[wd][h] ?? 0) / dayCount
        avgs[wd][h] = v
        if (v > max) max = v
      }
    }
    return { avgs, max }
  }, [bookings, range])

  const insight = useMemo(() => {
    let busiest: { wd: number; hour: number; v: number } | null = null
    let quietest: { wd: number; hour: number; v: number } | null = null
    for (let wd = 1; wd <= 7; wd++) {
      for (let h = range.earliest; h < range.latest; h++) {
        const v = grid.avgs[wd][h]
        if (v > 0 && (!busiest || v > busiest.v)) busiest = { wd, hour: h, v }
        if (v > 0 && (!quietest || v < quietest.v)) quietest = { wd, hour: h, v }
      }
    }
    return { busiest, quietest }
  }, [grid, range])

  return (
    <div>
      <h2 className="text-sm font-medium text-gray-900 mb-1">Travleste tider</h2>
      <p className="text-xs text-gray-500 mb-3">Gennemsnitligt antal klip per time/ugedag</p>
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="text-left font-medium text-gray-400 px-1 py-1.5"></th>
                {Array.from({ length: range.latest - range.earliest }, (_, i) => range.earliest + i).map((h) => (
                  <th key={h} className="font-medium text-gray-400 text-center px-1 py-1.5 tabular-nums">
                    {String(h).padStart(2, '0')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAY_LABELS.map((dayLabel, idx) => {
                const wd = idx + 1
                return (
                  <tr key={wd}>
                    <td className="text-right pr-2 text-gray-500 font-medium">{dayLabel}</td>
                    {Array.from({ length: range.latest - range.earliest }, (_, i) => range.earliest + i).map((h) => {
                      const v = grid.avgs[wd][h]
                      const ratio = grid.max > 0 ? v / grid.max : 0
                      const alpha = v <= 0 ? 0.04 : 0.1 + ratio * 0.85
                      return (
                        <td
                          key={h}
                          onMouseEnter={() => setHoverCell({ wd, hour: h, avg: v })}
                          onMouseLeave={() => setHoverCell(null)}
                          style={{ backgroundColor: `rgba(176, 138, 62, ${alpha})` }}
                          className="px-0.5 py-0 cursor-default"
                        >
                          <div className="aspect-square min-w-[18px] min-h-[18px]" />
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {hoverCell && (
          <div className="mt-2 text-xs text-gray-600">
            {DAY_FULL[hoverCell.wd - 1]} {String(hoverCell.hour).padStart(2, '0')}:00 — gennemsnit {hoverCell.avg.toFixed(1)} klip
          </div>
        )}

        {insight.busiest && insight.quietest && (
          <p className="mt-3 text-xs text-gray-500">
            Travleste tid:{' '}
            <span className="text-gray-800 font-medium">
              {DAY_FULL[insight.busiest.wd - 1]} {String(insight.busiest.hour).padStart(2, '0')}:00
            </span>
            <span className="mx-2 text-gray-300">·</span>
            Stilleste tid:{' '}
            <span className="text-gray-800 font-medium">
              {DAY_FULL[insight.quietest.wd - 1]} {String(insight.quietest.hour).padStart(2, '0')}:00
            </span>
          </p>
        )}
      </div>
    </div>
  )
}
