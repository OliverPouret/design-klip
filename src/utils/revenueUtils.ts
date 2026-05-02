// Format øre to DKK with Danish thousands separator: "24.500 kr"
export function formatDKK(ore: number): string {
  const kr = Math.round(ore / 100)
  return kr.toLocaleString('da-DK').replace(/,/g, '.') + ' kr'
}

// 1=Mon..7=Sun
export function getIsoWeekday(date: Date): number {
  const day = date.getDay()
  return day === 0 ? 7 : day
}

// Danish 25% VAT included in gross. VAT = gross × 0.20
export function calcMomsFromGross(grossOre: number): number {
  return Math.round(grossOre * 0.20)
}

export function formatDanishDate(d: Date): string {
  const months = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
  return `${d.getDate()}. ${months[d.getMonth()]}. ${d.getFullYear()}`
}

// "tirs. 9. jun. kl. 14.00"
export function formatDanishDateTime(d: Date): string {
  const weekdays = ['søn', 'man', 'tirs', 'ons', 'tors', 'fre', 'lør']
  const months = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  return `${weekdays[d.getDay()]}. ${d.getDate()}. ${months[d.getMonth()]}. kl. ${hh}.${mm}`
}

export function localMidnightUTC(d: Date): string {
  const local = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0)
  return local.toISOString()
}

export function localEndOfDayUTC(d: Date): string {
  const local = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
  return local.toISOString()
}

export function calcDelta(
  current: number,
  previous: number,
): { pct: number; direction: 'up' | 'down' | 'flat' } {
  if (previous === 0) return { pct: 0, direction: 'flat' }
  const pct = Math.round(((current - previous) / previous) * 100)
  return {
    pct: Math.abs(pct),
    direction: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat',
  }
}

export function avgTicket(totalRevenueOre: number, bookingCount: number): number {
  if (bookingCount === 0) return 0
  return Math.round(totalRevenueOre / bookingCount)
}
