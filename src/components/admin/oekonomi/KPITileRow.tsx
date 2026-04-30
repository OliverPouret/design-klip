import { formatDKK, calcDelta, avgTicket } from '../../../utils/revenueUtils'
import type { ComparisonMode } from '../../../hooks/useDateRange'

export interface BookingForKPI {
  id: string
  price_ore: number
  status: string
  starts_at: string
  ends_at: string | null
  barber_id: string | null
  services?: { name_da: string; duration_minutes: number } | null
}

export interface KPITileRowProps {
  current: BookingForKPI[]
  comparison: BookingForKPI[]
  comparisonMode: ComparisonMode
  workingMinutes: number
  comparisonWorkingMinutes: number
  onTileClick: (target: 'revenue' | 'avg' | 'count' | 'occupancy' | 'noShows') => void
}

const REVENUE_STATUSES = ['confirmed', 'completed']

function sumRevenue(bs: BookingForKPI[]): number {
  return bs
    .filter((b) => REVENUE_STATUSES.includes(b.status))
    .reduce((s, b) => s + (b.price_ore ?? 0), 0)
}

function nonCancelled(bs: BookingForKPI[]): BookingForKPI[] {
  return bs.filter((b) => b.status !== 'cancelled')
}

function bookedMinutes(bs: BookingForKPI[]): number {
  return nonCancelled(bs).reduce((s, b) => s + (b.services?.duration_minutes ?? 0), 0)
}

function noShowCount(bs: BookingForKPI[]): number {
  return bs.filter((b) => b.status === 'no_show').length
}

interface TileSpec {
  key: 'revenue' | 'avg' | 'count' | 'occupancy' | 'noShows'
  label: string
  value: string
  current: number
  previous: number
  invertColors?: boolean
  formatDelta?: (n: number) => string
}

export function KPITileRow({
  current,
  comparison,
  comparisonMode,
  workingMinutes,
  comparisonWorkingMinutes,
  onTileClick,
}: KPITileRowProps) {
  const curRev = sumRevenue(current)
  const prevRev = sumRevenue(comparison)
  const curCount = nonCancelled(current).length
  const prevCount = nonCancelled(comparison).length
  const curAvg = avgTicket(curRev, curCount)
  const prevAvg = avgTicket(prevRev, prevCount)
  const curBooked = bookedMinutes(current)
  const prevBooked = bookedMinutes(comparison)
  const curOccupancy = workingMinutes > 0 ? (curBooked / workingMinutes) * 100 : 0
  const prevOccupancy =
    comparisonWorkingMinutes > 0 ? (prevBooked / comparisonWorkingMinutes) * 100 : 0
  const curNoShows = noShowCount(current)
  const prevNoShows = noShowCount(comparison)

  const tiles: TileSpec[] = [
    {
      key: 'revenue',
      label: 'OMSÆTNING',
      value: formatDKK(curRev),
      current: curRev,
      previous: prevRev,
    },
    {
      key: 'avg',
      label: 'GNS. PRIS',
      value: formatDKK(curAvg),
      current: curAvg,
      previous: prevAvg,
    },
    {
      key: 'count',
      label: 'ANTAL KLIP',
      value: String(curCount),
      current: curCount,
      previous: prevCount,
    },
    {
      key: 'occupancy',
      label: 'BELÆGNING',
      value: `${Math.round(curOccupancy)}%`,
      current: curOccupancy,
      previous: prevOccupancy,
    },
    {
      key: 'noShows',
      label: 'UDEBLIVELSER',
      value: String(curNoShows),
      current: curNoShows,
      previous: prevNoShows,
      invertColors: true,
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {tiles.map((t) => {
        const delta = calcDelta(t.current, t.previous)
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onTileClick(t.key)}
            className="text-left bg-white border border-gray-200 rounded-lg p-4 hover:border-[#B08A3E]/40 hover:shadow-sm transition-all"
          >
            <p className="text-[10px] tracking-[0.08em] uppercase text-gray-400 font-semibold">
              {t.label}
            </p>
            <p className="font-serif text-[24px] text-gray-900 leading-none mt-2">{t.value}</p>
            <DeltaPill
              direction={delta.direction}
              pct={delta.pct}
              comparisonMode={comparisonMode}
              invertColors={t.invertColors}
            />
          </button>
        )
      })}
    </div>
  )
}

function DeltaPill({
  direction,
  pct,
  comparisonMode,
  invertColors,
}: {
  direction: 'up' | 'down' | 'flat'
  pct: number
  comparisonMode: ComparisonMode
  invertColors?: boolean
}) {
  const suffix = comparisonMode === 'last_year' ? 'vs sidste år' : 'vs forrige periode'
  if (direction === 'flat') {
    return (
      <p className="text-[11px] text-gray-400 mt-2">— {suffix}</p>
    )
  }
  const isUp = direction === 'up'
  const isPositive = invertColors ? !isUp : isUp
  const color = isPositive ? 'text-[#10B981]' : 'text-[#EF4444]'
  const arrow = isUp ? '↑' : '↓'
  return (
    <p className={`text-[11px] mt-2 font-medium ${color}`}>
      {arrow} {pct}% <span className="text-gray-400 font-normal">{suffix}</span>
    </p>
  )
}
