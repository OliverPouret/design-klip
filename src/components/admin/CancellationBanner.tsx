import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface CancelledBooking {
  id: string
  cancelled_at: string
  cancelled_by: string | null
  starts_at: string
  customer_name: string
  barber_name: string
  service_name: string
}

const DISMISS_KEY = 'designklip:dismissed_cancellations'
const POLL_INTERVAL_MS = 60_000
const VISIBLE_LIMIT = 5

const ICON_BELL = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
)

const ICON_X = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const WEEKDAY_FULL = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag']
const MONTH_FULL = [
  'januar', 'februar', 'marts', 'april', 'maj', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'december',
]
function shortDate(d: Date): string {
  return `${WEEKDAY_FULL[d.getDay()]} d. ${d.getDate()}. ${MONTH_FULL[d.getMonth()]}`
}
function shortTime(d: Date): string {
  return `kl. ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}
function relativeTime(d: Date): string {
  const ms = Date.now() - d.getTime()
  const mins = Math.round(ms / 60_000)
  if (mins < 1) return 'lige nu'
  if (mins < 60) return `for ${mins} min siden`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `for ${hours} ${hours === 1 ? 'time' : 'timer'} siden`
  const days = Math.round(hours / 24)
  return `for ${days} ${days === 1 ? 'dag' : 'dage'} siden`
}

function readDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    return new Set(Array.isArray(parsed) ? (parsed as string[]) : [])
  } catch {
    return new Set()
  }
}

function writeDismissed(ids: Set<string>) {
  try {
    localStorage.setItem(DISMISS_KEY, JSON.stringify(Array.from(ids)))
  } catch {
    // Convenience feature only — silently ignore storage failures.
  }
}

export function CancellationBanner() {
  const [items, setItems] = useState<CancelledBooking[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(() => readDismissed())
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    let cancelled = false
    const fetchItems = async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id, cancelled_at, cancelled_by, starts_at,
          customer:customers!inner(full_name),
          barber:barbers!inner(display_name),
          service:services!inner(name_da)
        `)
        .eq('status', 'cancelled')
        .gte('cancelled_at', since)
        .order('cancelled_at', { ascending: false })
        .limit(20)

      if (cancelled || error || !data) return
      const rows = (data as unknown as Array<{
        id: string
        cancelled_at: string
        cancelled_by: string | null
        starts_at: string
        customer: { full_name: string }
        barber: { display_name: string }
        service: { name_da: string }
      }>).map((r) => ({
        id: r.id,
        cancelled_at: r.cancelled_at,
        cancelled_by: r.cancelled_by,
        starts_at: r.starts_at,
        customer_name: r.customer.full_name,
        barber_name: r.barber.display_name,
        service_name: r.service.name_da,
      }))
      setItems(rows)
    }

    fetchItems()
    const interval = setInterval(fetchItems, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  const dismiss = (id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev)
      next.add(id)
      writeDismissed(next)
      return next
    })
  }

  const visible = items.filter((i) => !dismissed.has(i.id))
  if (visible.length === 0) return null

  const shown = expanded ? visible : visible.slice(0, VISIBLE_LIMIT)
  const hiddenCount = visible.length - shown.length

  return (
    <div className="px-4 md:px-6 pt-3 space-y-2">
      {shown.map((b) => {
        const startsAt = new Date(b.starts_at)
        const cancelledAt = new Date(b.cancelled_at)
        return (
          <div
            key={b.id}
            className="flex items-start gap-3 p-3 rounded-r-lg"
            style={{ backgroundColor: '#F1E2C2', borderLeft: '4px solid #B8761F' }}
          >
            <span className="mt-0.5 flex-shrink-0" style={{ color: '#B8761F' }}>
              {ICON_BELL}
            </span>
            <p className="flex-1 text-sm leading-snug" style={{ color: '#5C4310' }}>
              <span className="font-semibold">Aflyst:</span> {b.customer_name} havde{' '}
              {b.service_name} hos {b.barber_name} {shortDate(startsAt)} {shortTime(startsAt)} — aflyst{' '}
              {relativeTime(cancelledAt)}.
            </p>
            <button
              type="button"
              onClick={() => dismiss(b.id)}
              aria-label="Afvis besked"
              className="flex-shrink-0 p-1 rounded hover:bg-black/5 transition-colors"
              style={{ color: '#5C4310' }}
            >
              {ICON_X}
            </button>
          </div>
        )
      })}
      {!expanded && hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-[12px] text-accent-deep hover:underline"
        >
          Vis flere ({hiddenCount})
        </button>
      )}
    </div>
  )
}
