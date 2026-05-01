import { useMemo } from 'react'
import { formatDKK } from '../../../utils/revenueUtils'
import type { ComparisonMode } from '../../../hooks/useDateRange'
import type { BookingForKPI } from './KPITileRow'

interface MissedRevenueCardProps {
  current: BookingForKPI[]
  comparison: BookingForKPI[]
  comparisonMode: ComparisonMode
}

function totals(bs: BookingForKPI[]) {
  const noShows = bs.filter((b) => b.status === 'no_show')
  const cancelled = bs.filter((b) => b.status === 'cancelled')
  const noShowRevenue = noShows.reduce((s, b) => s + (b.price_ore ?? 0), 0)
  const cancelledRevenue = cancelled.reduce((s, b) => s + (b.price_ore ?? 0), 0)
  return {
    noShowCount: noShows.length,
    cancelledCount: cancelled.length,
    noShowRevenue,
    cancelledRevenue,
    total: noShowRevenue + cancelledRevenue,
  }
}

export function MissedRevenueCard({ current, comparison, comparisonMode }: MissedRevenueCardProps) {
  const cur = useMemo(() => totals(current), [current])
  const prev = useMemo(() => totals(comparison), [comparison])

  const diff = cur.total - prev.total
  const suffix = comparisonMode === 'last_year' ? 'sidste år' : 'forrige periode'

  if (cur.total === 0 && cur.noShowCount === 0 && cur.cancelledCount === 0) {
    return (
      <div id="section-missed">
        <h2 className="text-sm font-medium text-gray-900 mb-3">Tabt omsætning</h2>
        <div className="bg-[#10B981]/5 border border-[#10B981]/20 rounded-lg p-5">
          <p className="text-sm text-[#059669] italic">Ingen tabt omsætning i perioden 🎉</p>
        </div>
      </div>
    )
  }

  return (
    <div id="section-missed">
      <h2 className="text-sm font-medium text-gray-900 mb-3">Tabt omsætning</h2>
      <div className="bg-[#EF4444]/5 border border-[#EF4444]/20 rounded-lg p-5">
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-700">Udeblivelser (no-shows):</span>
            <span className="text-gray-900 font-medium tabular-nums">
              {formatDKK(cur.noShowRevenue)}{' '}
              <span className="text-gray-500 font-normal">({cur.noShowCount} {cur.noShowCount === 1 ? 'booking' : 'bookinger'})</span>
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-700">Aflyste:</span>
            <span className="text-gray-900 font-medium tabular-nums">
              {formatDKK(cur.cancelledRevenue)}{' '}
              <span className="text-gray-500 font-normal">({cur.cancelledCount} {cur.cancelledCount === 1 ? 'booking' : 'bookinger'})</span>
            </span>
          </div>
          <div className="border-t border-[#EF4444]/20 pt-2 mt-2 flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wide font-semibold text-[#EF4444]">Tabt i perioden</span>
            <span className="text-[#EF4444] font-bold tabular-nums">{formatDKK(cur.total)}</span>
          </div>
        </div>

        {prev.total > 0 || cur.total > 0 ? (
          <p className="text-xs mt-3 font-medium">
            {diff > 0 && (
              <span className="text-[#EF4444]">↑ {formatDKK(Math.abs(diff))} mere end {suffix}</span>
            )}
            {diff < 0 && (
              <span className="text-[#10B981]">↓ {formatDKK(Math.abs(diff))} mindre end {suffix}</span>
            )}
            {diff === 0 && <span className="text-gray-400">— samme niveau som {suffix}</span>}
          </p>
        ) : null}
      </div>
    </div>
  )
}
