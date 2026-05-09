import { FilterPill } from '../FilterPill'

export type RangeKey = 'today' | 'week' | 'month' | 'last30' | 'last90'

interface BarberOption {
  id: string
  display_name: string
}

interface OverblikHeaderProps {
  dateRange: RangeKey
  onDateRangeChange: (r: RangeKey) => void
  barberId: string | null
  onBarberChange: (id: string | null) => void
  barbers: BarberOption[]
}

const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: 'today', label: 'I dag' },
  { value: 'week', label: 'Denne uge' },
  { value: 'month', label: 'Denne måned' },
  { value: 'last30', label: 'Sidste 30 dage' },
  { value: 'last90', label: 'Sidste 90 dage' },
]

const ICON_CALENDAR = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
  </svg>
)
const ICON_USER = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)
const ICON_DOWNLOAD = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
)

export function OverblikHeader({
  dateRange,
  onDateRangeChange,
  barberId,
  onBarberChange,
  barbers,
}: OverblikHeaderProps) {
  const rangeLabel = RANGE_OPTIONS.find((o) => o.value === dateRange)?.label ?? 'Periode'
  const barberLabel =
    barberId === null
      ? 'Alle barberer'
      : (barbers.find((b) => b.id === barberId)?.display_name ?? 'Barber')

  const barberOptions = [
    { value: 'all' as const, label: 'Alle barberer' },
    ...barbers.map((b) => ({ value: b.id, label: b.display_name })),
  ]

  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <p className="text-[13px] text-gray-500">
        Forretningens nøgletal — opdateres automatisk.
      </p>
      <div className="flex flex-wrap gap-2 md:justify-end">
        <FilterPill
          label={rangeLabel}
          value={dateRange}
          options={RANGE_OPTIONS}
          onChange={onDateRangeChange}
          icon={ICON_CALENDAR}
        />
        <FilterPill<string>
          label={barberLabel}
          value={barberId ?? 'all'}
          options={barberOptions}
          onChange={(v) => onBarberChange(v === 'all' ? null : v)}
          icon={ICON_USER}
        />
        <FilterPill
          label="Eksportér"
          icon={ICON_DOWNLOAD}
          disabled
        />
      </div>
    </div>
  )
}
