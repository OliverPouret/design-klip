import type { DateRangePreset, ComparisonMode } from '../../../hooks/useDateRange'
import { formatDanishDate } from '../../../utils/revenueUtils'

interface FilterBarProps {
  preset: DateRangePreset
  start: Date
  end: Date
  comparison: ComparisonMode
  onPresetChange: (p: DateRangePreset) => void
  onCustomRange: (start: Date, end: Date) => void
  onComparisonChange: (m: ComparisonMode) => void
}

const PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: 'today', label: 'I dag' },
  { value: 'week', label: 'Denne uge' },
  { value: 'month', label: 'Denne måned' },
  { value: 'year', label: 'I år' },
  { value: 'custom', label: 'Brugerdefineret' },
]

function toInputValue(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function fromInputValue(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function FilterBar({
  preset,
  start,
  end,
  comparison,
  onPresetChange,
  onCustomRange,
  onComparisonChange,
}: FilterBarProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-wrap items-center gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {PRESETS.map((p) => {
          const active = preset === p.value
          return (
            <button
              key={p.value}
              type="button"
              onClick={() => onPresetChange(p.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                active
                  ? 'bg-[#B08A3E] border-[#B08A3E] text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-[#B08A3E]/40'
              }`}
            >
              {p.label}
            </button>
          )
        })}
      </div>

      {preset === 'custom' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={toInputValue(start)}
            onChange={(e) => onCustomRange(fromInputValue(e.target.value), end)}
            className="px-2 py-1 text-xs border border-gray-200 rounded-md focus:border-[#B08A3E] outline-none"
          />
          <span className="text-xs text-gray-400">–</span>
          <input
            type="date"
            value={toInputValue(end)}
            onChange={(e) => onCustomRange(start, fromInputValue(e.target.value))}
            className="px-2 py-1 text-xs border border-gray-200 rounded-md focus:border-[#B08A3E] outline-none"
          />
        </div>
      )}

      <span className="text-xs text-gray-500 hidden md:inline">
        {formatDanishDate(start)} – {formatDanishDate(end)}
      </span>

      <div className="ml-auto">
        <select
          value={comparison}
          onChange={(e) => onComparisonChange(e.target.value as ComparisonMode)}
          className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-md bg-white text-gray-700 focus:border-[#B08A3E] outline-none"
        >
          <option value="previous">Sammenlign med forrige periode</option>
          <option value="last_year">Sammenlign med samme periode sidste år</option>
        </select>
      </div>
    </div>
  )
}
