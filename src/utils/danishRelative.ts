// "for 2 timer siden", "i går", "for 3 dage siden" — Danish relative time
// formatter used by activity-feed surfaces (Historik, Overblik recent bookings).

export function relativeDanish(d: Date): string {
  const ms = Date.now() - d.getTime()
  const mins = Math.round(ms / 60_000)
  if (mins < 1) return 'lige nu'
  if (mins < 60) return `for ${mins} ${mins === 1 ? 'minut' : 'minutter'} siden`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `for ${hours} ${hours === 1 ? 'time' : 'timer'} siden`
  const days = Math.round(hours / 24)
  if (days === 1) return 'i går'
  if (days < 7) return `for ${days} dage siden`
  if (days < 30) {
    const weeks = Math.round(days / 7)
    return `for ${weeks} ${weeks === 1 ? 'uge' : 'uger'} siden`
  }
  const months = Math.round(days / 30)
  return `for ${months} ${months === 1 ? 'måned' : 'måneder'} siden`
}
