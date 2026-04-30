import { useMemo, useState } from 'react'
import { isoDate, isoWeekday } from '../../../lib/danishDates'

interface TimeOffRangePickerProps {
  onSubmit: (rangeStart: Date, rangeEnd: Date, reason: string) => Promise<void>
  submitting?: boolean
}

const MONTH_FULL = [
  'januar', 'februar', 'marts', 'april', 'maj', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'december',
]
const WEEKDAY_HEADERS = ['M', 'T', 'O', 'T', 'F', 'L', 'S']

function buildMonthDays(monthDate: Date): Date[] {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const first = new Date(year, month, 1)
  const offset = isoWeekday(first) - 1
  const start = new Date(year, month, 1 - offset)
  const days: Date[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    days.push(d)
  }
  return days
}

export function TimeOffRangePicker({ onSubmit, submitting = false }: TimeOffRangePickerProps) {
  const today = useMemo(() => {
    const t = new Date()
    t.setHours(0, 0, 0, 0)
    return t
  }, [])

  const [viewMonth, setViewMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [rangeStart, setRangeStart] = useState<Date | null>(null)
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null)
  const [reason, setReason] = useState('')

  const goPrev = () => {
    const prev = new Date(viewMonth)
    prev.setMonth(prev.getMonth() - 1)
    if (prev >= new Date(today.getFullYear(), today.getMonth(), 1)) setViewMonth(prev)
  }
  const goNext = () => {
    const next = new Date(viewMonth)
    next.setMonth(next.getMonth() + 1)
    setViewMonth(next)
  }
  const canGoBack = viewMonth > new Date(today.getFullYear(), today.getMonth(), 1)

  const handleDayClick = (d: Date) => {
    if (d < today) return
    if (!rangeStart) {
      setRangeStart(d)
      setRangeEnd(null)
      return
    }
    if (rangeEnd) {
      // Already had a complete range — start fresh
      setRangeStart(d)
      setRangeEnd(null)
      return
    }
    if (d < rangeStart) {
      // User clicked an earlier date — treat that as new start
      setRangeStart(d)
      setRangeEnd(null)
      return
    }
    setRangeEnd(d)
  }

  const isInRange = (d: Date): boolean => {
    if (!rangeStart) return false
    if (!rangeEnd) return isoDate(d) === isoDate(rangeStart)
    return d >= rangeStart && d <= rangeEnd
  }

  const isRangeBoundary = (d: Date): boolean => {
    if (rangeStart && isoDate(d) === isoDate(rangeStart)) return true
    if (rangeEnd && isoDate(d) === isoDate(rangeEnd)) return true
    return false
  }

  const handleClear = () => {
    setRangeStart(null)
    setRangeEnd(null)
    setReason('')
  }

  const handleSubmit = async () => {
    if (!rangeStart) return
    const end = rangeEnd ?? rangeStart
    await onSubmit(rangeStart, end, reason.trim())
    handleClear()
  }

  const nextMonth = useMemo(() => {
    const d = new Date(viewMonth)
    d.setMonth(d.getMonth() + 1)
    return d
  }, [viewMonth])

  const renderMonth = (monthDate: Date) => {
    const month = monthDate.getMonth()
    const days = buildMonthDays(monthDate)
    return (
      <div className="flex-1 min-w-0">
        <div className="text-center text-[12px] font-medium text-gray-700 capitalize mb-2">
          {MONTH_FULL[month]} {monthDate.getFullYear()}
        </div>
        <div className="grid grid-cols-7 mb-1">
          {WEEKDAY_HEADERS.map((d, i) => (
            <div
              key={i}
              className="text-center py-1 text-[10px] font-semibold tracking-[0.08em] uppercase text-gray-400"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {days.map((d, i) => {
            const outside = d.getMonth() !== month
            const past = d < today
            const inRange = isInRange(d)
            const boundary = isRangeBoundary(d)
            const disabled = past || outside

            const cls = [
              'aspect-square rounded text-[11px] flex items-center justify-center transition-colors',
              outside ? 'opacity-0 pointer-events-none' : '',
              !outside && past ? 'opacity-40 cursor-not-allowed text-gray-400' : '',
              !disabled && !inRange ? 'text-gray-700 hover:bg-gray-100' : '',
              !disabled && inRange && !boundary ? 'bg-[#B08A3E]/15 text-[#8C6A28]' : '',
              !disabled && boundary ? 'bg-[#B08A3E] text-white font-semibold' : '',
            ]
              .filter(Boolean)
              .join(' ')

            return (
              <button
                key={i}
                type="button"
                onClick={() => !disabled && handleDayClick(d)}
                disabled={disabled}
                className={cls}
              >
                {d.getDate()}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const dayCount = (() => {
    if (!rangeStart) return 0
    const end = rangeEnd ?? rangeStart
    const ms = end.getTime() - rangeStart.getTime()
    return Math.floor(ms / (1000 * 60 * 60 * 24)) + 1
  })()

  return (
    <div className="space-y-3">
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={goPrev}
            disabled={!canGoBack}
            className="px-2 py-1 text-xs text-gray-500 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ←
          </button>
          <span className="text-[11px] tracking-[0.08em] uppercase text-gray-400 font-medium">
            Vælg start- og slutdato
          </span>
          <button
            type="button"
            onClick={goNext}
            className="px-2 py-1 text-xs text-gray-500 hover:text-gray-900"
          >
            →
          </button>
        </div>
        <div className="p-3 flex flex-col md:flex-row gap-3">
          {renderMonth(viewMonth)}
          {renderMonth(nextMonth)}
        </div>
      </div>

      {rangeStart && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">
              {dayCount === 1
                ? '1 dag valgt'
                : rangeEnd
                  ? `${dayCount} dage valgt`
                  : 'Vælg slutdato (eller klik samme dato igen for én dag)'}
            </span>
            <button
              type="button"
              onClick={handleClear}
              className="text-gray-400 hover:text-gray-700"
            >
              Nulstil
            </button>
          </div>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ferie, syg, andet…"
            className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-xs text-gray-700 outline-none focus:border-[#B08A3E]"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !rangeStart}
            className="w-full px-3 py-2 bg-[#B08A3E] hover:bg-[#8C6A28] text-white text-xs font-medium rounded-md transition-colors disabled:opacity-50"
          >
            {submitting ? 'Tilføjer…' : dayCount > 1 ? `Tilføj ${dayCount} fridage` : 'Tilføj fridag'}
          </button>
        </div>
      )}
    </div>
  )
}
