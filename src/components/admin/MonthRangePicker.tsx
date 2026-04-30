import { useEffect, useState } from 'react'

interface MonthRangePickerProps {
  value: number
  max: number
  onChange: (months: number) => void
}

const PRESETS = [1, 3, 6, 12]

export function MonthRangePicker({ value, max, onChange }: MonthRangePickerProps) {
  const [draft, setDraft] = useState<string>(String(value))

  // Keep draft in sync if parent changes value programmatically
  useEffect(() => {
    setDraft(String(value))
  }, [value])

  // Debounce custom input to avoid firing on every keystroke
  useEffect(() => {
    const n = parseInt(draft, 10)
    if (isNaN(n)) return
    if (n === value) return
    const clamped = Math.max(1, Math.min(max, n))
    const t = setTimeout(() => onChange(clamped), 500)
    return () => clearTimeout(t)
  }, [draft, max, value, onChange])

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
      <span className="text-gray-500">Vis data for de seneste</span>

      <div className="flex items-center gap-1.5">
        {PRESETS.filter((p) => p <= max).map((p) => {
          const active = value === p
          return (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                active
                  ? 'bg-[#B08A3E] border-[#B08A3E] text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-[#B08A3E]/40'
              }`}
            >
              {p}
            </button>
          )
        })}
        <input
          type="number"
          min={1}
          max={max}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-16 px-2.5 py-1 rounded-md text-xs border border-gray-200 bg-white text-gray-700 outline-none focus:border-[#B08A3E] focus:ring-2 focus:ring-[#B08A3E]/15 transition-all"
          aria-label="Antal måneder"
        />
      </div>

      <span className="text-gray-500">{value === 1 ? 'måned' : 'måneder'}</span>
      <span className="text-xs text-gray-400">(maks {max})</span>
    </div>
  )
}
