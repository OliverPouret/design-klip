import { useMemo } from 'react'
import { formatDKK } from '../../../utils/revenueUtils'
import type { BookingForKPI } from './KPITileRow'

interface ServiceBreakdownProps {
  bookings: BookingForKPI[]
}

export function ServiceBreakdown({ bookings }: ServiceBreakdownProps) {
  const rows = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number }>()
    for (const b of bookings) {
      const name = b.services?.name_da
      if (!name) continue
      if (b.status === 'cancelled') continue
      const cur = map.get(name) ?? { count: 0, revenue: 0 }
      cur.count += 1
      if (['confirmed', 'completed'].includes(b.status)) {
        cur.revenue += b.price_ore ?? 0
      }
      map.set(name, cur)
    }
    const totalRevenue = Array.from(map.values()).reduce((s, v) => s + v.revenue, 0)
    return Array.from(map.entries())
      .map(([name, v]) => ({
        name,
        count: v.count,
        revenue: v.revenue,
        sharePct: totalRevenue > 0 ? Math.round((v.revenue / totalRevenue) * 100) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
  }, [bookings])

  if (rows.length === 0) {
    return (
      <div>
        <h2 className="text-sm font-medium text-gray-900 mb-3">Ydelser — fordeling</h2>
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <p className="text-sm text-gray-500 italic">Ingen ydelser i perioden.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-sm font-medium text-gray-900 mb-3">Ydelser — fordeling</h2>
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
        {rows.map((r) => (
          <div key={r.name}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium text-gray-900 truncate">{r.name}</span>
              <span className="text-xs text-gray-500 whitespace-nowrap">
                {r.count} klip · <span className="text-gray-700 font-medium">{formatDKK(r.revenue)}</span>
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="flex-1 h-2 bg-gray-100 rounded overflow-hidden">
                <div
                  className="h-full bg-[#B08A3E]"
                  style={{ width: `${r.sharePct}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 tabular-nums w-9 text-right">{r.sharePct}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
