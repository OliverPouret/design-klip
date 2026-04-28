const WEEKDAY_SHORT = ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør']
const WEEKDAY_FULL = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag']
const MONTH_FULL = [
  'januar', 'februar', 'marts', 'april', 'maj', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'december',
]

export function formatDayShort(date: Date): string {
  return WEEKDAY_SHORT[date.getDay()]
}

export function formatDayFull(date: Date): string {
  return WEEKDAY_FULL[date.getDay()]
}

export function formatMonthYear(date: Date): string {
  return `${MONTH_FULL[date.getMonth()]} ${date.getFullYear()}`
}

export function formatDateLong(date: Date): string {
  return `${WEEKDAY_FULL[date.getDay()]} d. ${date.getDate()}. ${MONTH_FULL[date.getMonth()]}`
}

export function formatTime(date: Date): string {
  return `kl. ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}

export function formatTimeShort(date: Date): string {
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}

export function isoDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

// ISO weekday: 1 = Monday, 7 = Sunday
export function isoWeekday(date: Date): number {
  const day = date.getDay()
  return day === 0 ? 7 : day
}
