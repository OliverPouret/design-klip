import { isoDate } from '../lib/danishDates'

interface TimeOffRange {
  starts_at: string
  ends_at: string
}

/**
 * Walk each [starts_at, ends_at) range day by day using local Copenhagen
 * components and produce a Set of YYYY-MM-DD strings the barber is unavailable.
 *
 * Never use toISOString().split('T')[0] — UTC offset would break by one day.
 */
export function getDisabledDates(timeOffEntries: TimeOffRange[]): Set<string> {
  const set = new Set<string>()
  for (const entry of timeOffEntries) {
    const start = new Date(entry.starts_at)
    const end = new Date(entry.ends_at)
    const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate())
    const stop = new Date(end.getFullYear(), end.getMonth(), end.getDate())
    while (cur < stop) {
      set.add(isoDate(cur))
      cur.setDate(cur.getDate() + 1)
    }
  }
  return set
}

interface BarberHourRow {
  isoweekday: number
  opens_at: string | null
}

/**
 * Build a Set<number> of isoweekday values where the barber does NOT work
 * (opens_at is null OR no row exists for that weekday).
 */
export function getNonWorkingDays(rows: BarberHourRow[]): Set<number> {
  const set = new Set<number>([1, 2, 3, 4, 5, 6, 7])
  for (const r of rows) {
    if (r.opens_at) set.delete(r.isoweekday)
  }
  return set
}
