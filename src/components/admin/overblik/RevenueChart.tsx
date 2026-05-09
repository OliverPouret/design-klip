import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatDKK } from '../../../utils/revenueUtils'

export interface RevenueDayRow {
  day: string
  revenue_ore: number
  bookings_count: number
}

interface RevenueChartProps {
  data: RevenueDayRow[]
  loading?: boolean
}

type PeriodKey = '7' | '30' | '90'

const WEEKDAY_SHORT = ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør']
const MONTH_SHORT = [
  'jan', 'feb', 'mar', 'apr', 'maj', 'jun',
  'jul', 'aug', 'sep', 'okt', 'nov', 'dec',
]

function parseDay(day: string): Date {
  // 'YYYY-MM-DD' from postgres date column.
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

function formatTickShort(day: string): string {
  const d = parseDay(day)
  return WEEKDAY_SHORT[d.getDay()]
}

function formatTickLong(day: string): string {
  const d = parseDay(day)
  return `${d.getDate()}. ${MONTH_SHORT[d.getMonth()]}`
}

function formatTooltipDate(day: string): string {
  const d = parseDay(day)
  return `${WEEKDAY_SHORT[d.getDay()]}. ${d.getDate()}. ${MONTH_SHORT[d.getMonth()]}`
}

interface ChartTooltipProps {
  active?: boolean
  payload?: ReadonlyArray<{ payload?: unknown }>
}

function ChartTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const row = payload[0]?.payload as RevenueDayRow | undefined
  if (!row) return null
  return (
    <div
      className="rounded-md px-3 py-2 text-[12px] shadow-lg"
      style={{ backgroundColor: '#1A1A1A', color: '#FFFFFF' }}
    >
      <p className="font-medium mb-1">{formatTooltipDate(row.day)}</p>
      <p className="flex items-center gap-2">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: '#B08A3E' }}
          aria-hidden="true"
        />
        <span>Omsætning</span>
        <span className="ml-auto font-medium tabular-nums">{formatDKK(row.revenue_ore)}</span>
      </p>
      <p className="flex items-center gap-2 mt-0.5">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: '#5C7A4A' }}
          aria-hidden="true"
        />
        <span>Bookinger</span>
        <span className="ml-auto font-medium tabular-nums">{row.bookings_count}</span>
      </p>
    </div>
  )
}

const PERIOD_OPTIONS: { value: PeriodKey; label: string }[] = [
  { value: '7', label: '7d' },
  { value: '30', label: '30d' },
  { value: '90', label: '90d' },
]

export function RevenueChart({ data, loading = false }: RevenueChartProps) {
  const [period, setPeriod] = useState<PeriodKey>('30')
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const sliced = useMemo(() => {
    const n = parseInt(period, 10)
    if (data.length <= n) return data
    return data.slice(data.length - n)
  }, [data, period])

  const useShortTick = sliced.length <= 14

  const avgRevenue = useMemo(() => {
    if (sliced.length === 0) return 0
    const sum = sliced.reduce((s, r) => s + r.revenue_ore, 0)
    return Math.round(sum / sliced.length)
  }, [sliced])

  const defaultActiveIdx = sliced.length > 0 ? sliced.length - 1 : null
  const highlightedIdx = activeIndex ?? defaultActiveIdx

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 flex flex-col">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="font-serif text-[20px] text-ink leading-tight">Omsætning</h3>
        <div
          role="tablist"
          aria-label="Periode"
          className="inline-flex rounded-full p-0.5"
          style={{ backgroundColor: '#F4F0E6' }}
        >
          {PERIOD_OPTIONS.map((opt) => {
            const active = period === opt.value
            return (
              <button
                key={opt.value}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => {
                  setPeriod(opt.value)
                  setActiveIndex(null)
                }}
                className="px-3 py-1 text-[12px] font-medium rounded-full transition-colors"
                style={{
                  backgroundColor: active ? '#FFFFFF' : 'transparent',
                  color: active ? '#8C6A28' : '#6B5B45',
                  boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : undefined,
                }}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex-1 min-h-[260px]">
        {loading ? (
          <div className="h-[260px] bg-gray-50 rounded animate-pulse" />
        ) : sliced.length === 0 || sliced.every((r) => r.revenue_ore === 0 && r.bookings_count === 0) ? (
          <div className="h-[260px] flex items-center justify-center">
            <p className="font-serif text-[18px] text-gray-400">
              Ingen bookinger i denne periode endnu.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={sliced}
              margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
              barCategoryGap="22%"
              barGap={2}
              onMouseLeave={() => setActiveIndex(null)}
            >
              <XAxis
                dataKey="day"
                tickFormatter={useShortTick ? formatTickShort : formatTickLong}
                tick={{ fill: '#9CA3AF', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#E5E5E5' }}
                interval={useShortTick ? 0 : 'preserveStartEnd'}
                minTickGap={useShortTick ? 0 : 16}
              />
              <YAxis
                yAxisId="rev"
                orientation="left"
                tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000 / 100) / 10}k` : `${v / 100}`)}
                tick={{ fill: '#9CA3AF', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={42}
              />
              <YAxis
                yAxisId="cnt"
                orientation="right"
                allowDecimals={false}
                tick={{ fill: '#9CA3AF', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={28}
              />
              <Tooltip
                cursor={{ fill: 'rgba(176, 138, 62, 0.06)' }}
                content={ChartTooltip}
              />
              {avgRevenue > 0 && (
                <ReferenceLine
                  yAxisId="rev"
                  y={avgRevenue}
                  stroke="#8C6A28"
                  strokeDasharray="3 4"
                  strokeOpacity={0.5}
                />
              )}
              <Bar
                yAxisId="rev"
                dataKey="revenue_ore"
                radius={[3, 3, 0, 0]}
                onClick={(_data, idx) => setActiveIndex(idx)}
              >
                {sliced.map((row, idx) => (
                  <Cell
                    key={`rev-${row.day}`}
                    fill={highlightedIdx === idx ? '#8C6A28' : '#B08A3E'}
                    cursor="pointer"
                  />
                ))}
              </Bar>
              <Bar
                yAxisId="cnt"
                dataKey="bookings_count"
                radius={[3, 3, 0, 0]}
                onClick={(_data, idx) => setActiveIndex(idx)}
              >
                {sliced.map((row, idx) => (
                  <Cell
                    key={`cnt-${row.day}`}
                    fill={highlightedIdx === idx ? '#3A5030' : '#5C7A4A'}
                    cursor="pointer"
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
