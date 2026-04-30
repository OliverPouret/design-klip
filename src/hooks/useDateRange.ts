import { useState, useMemo, useCallback } from 'react'

export type DateRangePreset = 'today' | 'week' | 'month' | 'year' | 'custom'
export type ComparisonMode = 'previous' | 'last_year'

export interface DateRangeState {
  preset: DateRangePreset
  start: Date
  end: Date
  comparison: ComparisonMode
  comparisonStart: Date
  comparisonEnd: Date
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
}

function startOfWeekMonday(d: Date): Date {
  const day = d.getDay() // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff)
  return startOfDay(monday)
}

function endOfWeekSunday(start: Date): Date {
  const sun = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6)
  return endOfDay(sun)
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0)
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
}

function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0)
}

function endOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999)
}

function resolvePreset(preset: DateRangePreset, today: Date): { start: Date; end: Date } {
  switch (preset) {
    case 'today':
      return { start: startOfDay(today), end: endOfDay(today) }
    case 'week': {
      const s = startOfWeekMonday(today)
      return { start: s, end: endOfWeekSunday(s) }
    }
    case 'month':
      return { start: startOfMonth(today), end: endOfMonth(today) }
    case 'year':
      return { start: startOfYear(today), end: endOfYear(today) }
    default:
      return { start: startOfMonth(today), end: endOfMonth(today) }
  }
}

function resolveComparison(
  start: Date,
  end: Date,
  mode: ComparisonMode,
): { comparisonStart: Date; comparisonEnd: Date } {
  if (mode === 'last_year') {
    const cs = new Date(start)
    cs.setFullYear(cs.getFullYear() - 1)
    const ce = new Date(end)
    ce.setFullYear(ce.getFullYear() - 1)
    return { comparisonStart: cs, comparisonEnd: ce }
  }
  const lengthMs = end.getTime() - start.getTime()
  const ce = new Date(start.getTime() - 1)
  const cs = new Date(ce.getTime() - lengthMs)
  return { comparisonStart: cs, comparisonEnd: ce }
}

export function useDateRange() {
  const [preset, setPresetState] = useState<DateRangePreset>('month')
  const [customRange, setCustomRangeState] = useState<{ start: Date; end: Date } | null>(null)
  const [comparison, setComparisonState] = useState<ComparisonMode>('previous')

  const state = useMemo<DateRangeState>(() => {
    const today = new Date()
    let start: Date
    let end: Date
    if (preset === 'custom' && customRange) {
      start = startOfDay(customRange.start)
      end = endOfDay(customRange.end)
    } else {
      const resolved = resolvePreset(preset === 'custom' ? 'month' : preset, today)
      start = resolved.start
      end = resolved.end
    }
    const { comparisonStart, comparisonEnd } = resolveComparison(start, end, comparison)
    return { preset, start, end, comparison, comparisonStart, comparisonEnd }
  }, [preset, customRange, comparison])

  const setPreset = useCallback((p: DateRangePreset) => {
    setPresetState(p)
    if (p !== 'custom') setCustomRangeState(null)
  }, [])

  const setCustomRange = useCallback((start: Date, end: Date) => {
    setCustomRangeState({ start, end })
    setPresetState('custom')
  }, [])

  const setComparison = useCallback((mode: ComparisonMode) => {
    setComparisonState(mode)
  }, [])

  return { state, setPreset, setCustomRange, setComparison }
}
