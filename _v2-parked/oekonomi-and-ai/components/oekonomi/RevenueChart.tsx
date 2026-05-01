import { useMemo } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts'
import type { BookingForKPI } from './KPITileRow'
import { formatDKK, formatDanishDate, getIsoWeekday } from '../../../utils/revenueUtils'
import type { ComparisonMode } from '../../../hooks/useDateRange'

interface BarberHourRow {
  barber_id: string
  isoweekday: number
  opens_at: string | null
  closes_at: string | null
}

interface RevenueChartProps {
  current: BookingForKPI[]
  comparison: BookingForKPI[]
  comparisonMode: ComparisonMode
  start: Date
  end: Date
  hours: BarberHourRow[]
  activeBarberIds: string[]
}

interface ChartPoint {
  dateKey: string
  label: string
  actual: number | null
  projected: number | null
  comparison: number | null
  count: number
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function shortLabel(d: Date): string {
  return `${d.getDate()}/${d.getMonth() + 1}`
}

function timeStrToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m ?? 0)
}

export function RevenueChart({
  current,
  comparison,
  comparisonMode,
  start,
  end,
  hours,
  activeBarberIds,
}: RevenueChartProps) {
  const data = useMemo<ChartPoint[]>(() => {
    const today = new Date()
    const todayKey = dayKey(today)

    const actualByDay = new Map<string, { revenue: number; count: number }>()
    for (const b of current) {
      if (!['confirmed', 'completed'].includes(b.status)) continue
      const k = dayKey(new Date(b.starts_at))
      const cur = actualByDay.get(k) ?? { revenue: 0, count: 0 }
      cur.revenue += b.price_ore ?? 0
      cur.count += 1
      actualByDay.set(k, cur)
    }

    // Comparison overlay
    const cmpByPeriodIndex = new Map<number, number>()
    {
      const cmpStart = comparisonMode === 'last_year'
        ? new Date(start.getFullYear() - 1, start.getMonth(), start.getDate())
        : null
      // Approach: for each comparison booking, compute its day-index relative to comparison start
      const referenceStart = (() => {
        if (comparisonMode === 'last_year' && cmpStart) return cmpStart
        const len = end.getTime() - start.getTime()
        return new Date(start.getTime() - len - 1)
      })()
      for (const b of comparison) {
        if (!['confirmed', 'completed'].includes(b.status)) continue
        const t = new Date(b.starts_at)
        const idx = Math.floor((t.getTime() - referenceStart.getTime()) / (24 * 60 * 60 * 1000))
        cmpByPeriodIndex.set(idx, (cmpByPeriodIndex.get(idx) ?? 0) + (b.price_ore ?? 0))
      }
    }

    // Build per-weekday averages from current actual (used for projection past today)
    const wdSum: number[] = [0, 0, 0, 0, 0, 0, 0, 0]
    const wdCount: number[] = [0, 0, 0, 0, 0, 0, 0, 0]
    const seen = new Set<string>()
    for (const [k, v] of actualByDay.entries()) {
      const [y, m, d] = k.split('-').map(Number)
      const dt = new Date(y, m - 1, d)
      const wd = getIsoWeekday(dt)
      wdSum[wd] += v.revenue
      if (!seen.has(k)) {
        wdCount[wd] += 1
        seen.add(k)
      }
    }
    const wdAvg = wdSum.map((s, i) => (wdCount[i] > 0 ? s / wdCount[i] : 0))

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
    const typicalByWd: number[] = [0, 0, 0, 0, 0, 0, 0, 0]
    for (let wd = 1; wd <= 7; wd++) {
      let max = 0
      for (const bid of activeBarberIds) {
        const h = hoursMap.get(`${bid}-${wd}`)
        if (h?.opens_at && h?.closes_at) {
          max += timeStrToMinutes(h.closes_at) - timeStrToMinutes(h.opens_at)
        }
      }
      typicalByWd[wd] = max
    }

    const points: ChartPoint[] = []
    const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate())
    const stop = new Date(end.getFullYear(), end.getMonth(), end.getDate())
    let idx = 0
    while (cur.getTime() <= stop.getTime()) {
      const k = dayKey(cur)
      const isPast = k <= todayKey
      const actual = actualByDay.get(k)
      const wd = getIsoWeekday(cur)
      const typical = typicalByWd[wd]
      const avail = workingMinutesForDate(cur)
      const ratio = typical > 0 ? Math.min(1, avail / typical) : 0
      const projectedValue = isPast ? null : Math.round(wdAvg[wd] * ratio / 100)
      points.push({
        dateKey: k,
        label: shortLabel(cur),
        actual: isPast ? Math.round((actual?.revenue ?? 0) / 100) : null,
        projected: projectedValue,
        comparison: cmpByPeriodIndex.has(idx) ? Math.round(cmpByPeriodIndex.get(idx)! / 100) : null,
        count: actual?.count ?? 0,
      })
      cur.setDate(cur.getDate() + 1)
      idx += 1
    }
    return points
  }, [current, comparison, comparisonMode, start, end, hours, activeBarberIds])

  const todayLabel = useMemo(() => {
    const tk = dayKey(new Date())
    return data.find((p) => p.dateKey === tk)?.label
  }, [data])

  const stats = useMemo(() => {
    const actuals = data
      .filter((p) => p.actual !== null && p.actual > 0)
      .map((p) => ({ label: p.label, value: p.actual as number }))
    if (actuals.length === 0) {
      return { high: null as null | { label: string; value: number }, low: null as null | { label: string; value: number }, avg: 0 }
    }
    const high = actuals.reduce((a, b) => (a.value > b.value ? a : b))
    const low = actuals.reduce((a, b) => (a.value < b.value ? a : b))
    const avg = Math.round(actuals.reduce((s, p) => s + p.value, 0) / actuals.length)
    return { high, low, avg }
  }, [data])

  const labelToDate = (label: string): Date | null => {
    const point = data.find((p) => p.label === label)
    if (!point) return null
    const [y, m, d] = point.dateKey.split('-').map(Number)
    return new Date(y, m - 1, d)
  }

  return (
    <div id="section-chart">
      <h2 className="text-sm font-medium text-gray-900 mb-3">Omsætning</h2>
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="h-[220px] md:h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 12, bottom: 4, left: -8 }}>
              <CartesianGrid stroke="#F3F4F6" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9CA3AF' }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} width={48} />
              <Tooltip
                contentStyle={{ fontSize: 12, border: '1px solid #E5E7EB', borderRadius: 6 }}
                formatter={(value, name) => {
                  if (value == null) return ['—', name as string]
                  const n = typeof value === 'number' ? value : Number(value)
                  return [`${n.toLocaleString('da-DK').replace(/,/g, '.')} kr`, name as string]
                }}
                labelFormatter={(label) => {
                  const d = labelToDate(String(label))
                  return d ? formatDanishDate(d) : String(label)
                }}
              />
              {todayLabel && (
                <ReferenceLine x={todayLabel} stroke="#B08A3E" strokeDasharray="2 2" strokeOpacity={0.5} />
              )}
              {comparison.length > 0 && (
                <Line
                  type="monotone"
                  dataKey="comparison"
                  name="Sammenligning"
                  stroke="#9CA3AF"
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              )}
              <Line
                type="monotone"
                dataKey="actual"
                name="Faktisk"
                stroke="#B08A3E"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="projected"
                name="Prognose"
                stroke="#B08A3E"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {stats.high && stats.low && (
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
            <span>
              Højeste dag:{' '}
              <span className="text-gray-700 font-medium">
                {labelToDate(stats.high.label) ? formatDanishDate(labelToDate(stats.high.label)!) : stats.high.label}
              </span>{' '}
              — {formatDKK(stats.high.value * 100)}
            </span>
            <span>
              Laveste dag:{' '}
              <span className="text-gray-700 font-medium">
                {labelToDate(stats.low.label) ? formatDanishDate(labelToDate(stats.low.label)!) : stats.low.label}
              </span>{' '}
              — {formatDKK(stats.low.value * 100)}
            </span>
            <span>
              Gennemsnit per dag:{' '}
              <span className="text-gray-700 font-medium">{formatDKK(stats.avg * 100)}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
