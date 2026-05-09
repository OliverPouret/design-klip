import { Area, AreaChart, ResponsiveContainer } from 'recharts'

export type KPICardVariant = 'flat' | 'sparkline' | 'fraction'

export interface TrendInfo {
  pct: number
  direction: 'up' | 'down' | 'flat'
}

interface KPICardProps {
  label: string
  // The big number. For 'fraction' variant, this is the numerator.
  value: number | string
  // Suffix shown next to the number ("bookinger" / "kr" / "timer"). For
  // 'fraction', this becomes "/ {fractionDenominator} timer".
  suffix?: string
  variant?: KPICardVariant
  fractionDenominator?: number
  trend?: TrendInfo
  // Sparkline points (revenue per day). One point per day. Variant must be
  // 'sparkline' for this to render.
  sparkline?: { day: string; value: number }[]
  loading?: boolean
}

const ICON_UP = (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="18 15 12 9 6 15" />
  </svg>
)
const ICON_DOWN = (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="6 9 12 15 18 9" />
  </svg>
)
const ICON_FLAT = (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="6" y1="12" x2="18" y2="12" />
  </svg>
)

function TrendPill({ trend }: { trend: TrendInfo }) {
  const styles =
    trend.direction === 'up'
      ? { bg: '#E3E8D5', color: '#3A5030', icon: ICON_UP }
      : trend.direction === 'down'
        ? { bg: '#EFD8D2', color: '#9A2A2A', icon: ICON_DOWN }
        : { bg: '#F4F4F4', color: '#6B5B45', icon: ICON_FLAT }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ backgroundColor: styles.bg, color: styles.color }}
    >
      <span>{styles.icon}</span>
      {trend.direction === 'flat' ? '0%' : `${trend.direction === 'up' ? '+' : '−'}${trend.pct}%`}
    </span>
  )
}

export function KPICard({
  label,
  value,
  suffix,
  variant = 'flat',
  fractionDenominator,
  trend,
  sparkline,
  loading = false,
}: KPICardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 flex flex-col gap-3 min-h-[120px]">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[10px] tracking-[0.08em] uppercase text-gray-400 font-medium">
          {label}
        </div>
        {trend && !loading && <TrendPill trend={trend} />}
      </div>

      <div className="flex-1 flex items-end">
        {loading ? (
          <div className="h-8 w-20 bg-gray-100 rounded animate-pulse" />
        ) : (
          <div className="leading-none">
            <span className="text-[32px] font-semibold text-ink tabular-nums">{value}</span>
            {variant === 'fraction' && fractionDenominator !== undefined && (
              <span className="text-[20px] text-gray-400 font-normal tabular-nums">
                {' / '}
                {fractionDenominator}
              </span>
            )}
            {suffix && (
              <span className="text-[13px] text-gray-400 font-normal ml-1.5">{suffix}</span>
            )}
          </div>
        )}
      </div>

      {variant === 'sparkline' && sparkline && sparkline.length > 1 && !loading && (
        <div className="h-7 -mx-2 -mb-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkline} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
              <defs>
                <linearGradient id="kpi-spark-gold" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#B08A3E" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#B08A3E" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke="#B08A3E"
                strokeWidth={1.5}
                fill="url(#kpi-spark-gold)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
