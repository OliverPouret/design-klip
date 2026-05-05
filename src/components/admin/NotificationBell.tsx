import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface NotificationItem {
  id: string
  starts_at: string
  status: 'cancelled' | 'no_show'
  cancelled_by: string | null
  cancelled_at: string | null
  customer_name: string
  barber_name: string
  service_name: string
}

const POLL_INTERVAL_MS = 60_000
const FETCH_LIMIT = 50

const ICON_BELL = (
  <svg
    width="22"
    height="22"
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

const ICON_X_SMALL = (
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

function formatBookingDate(d: Date): string {
  return `${WEEKDAY_FULL[d.getDay()]} d. ${d.getDate()}. ${MONTH_FULL[d.getMonth()]}`
}
function formatBookingTime(d: Date): string {
  return `kl. ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

function relativeDanish(d: Date): string {
  const ms = Date.now() - d.getTime()
  const mins = Math.round(ms / 60_000)
  if (mins < 1) return 'lige nu'
  if (mins < 60) return `for ${mins} ${mins === 1 ? 'minut' : 'minutter'} siden`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `for ${hours} ${hours === 1 ? 'time' : 'timer'} siden`
  const days = Math.round(hours / 24)
  if (days === 1) return 'i går'
  if (days < 7) return `for ${days} dage siden`
  return 'for over en uge siden'
}

function notificationHeadline(n: NotificationItem): string {
  if (n.status === 'no_show') return `Udeblevet — ${n.customer_name}`
  if (n.cancelled_by === 'admin' || n.cancelled_by === 'shop') {
    return `Aflyst af salonen — ${n.customer_name}`
  }
  return `Aflyst af kunde — ${n.customer_name}`
}

function notificationTimestamp(n: NotificationItem): Date {
  // No-show timestamps don't exist yet (added in a later spec); fall back
  // to cancelled_at for cancelled rows and starts_at otherwise so newest
  // events still float to the top.
  if (n.cancelled_at) return new Date(n.cancelled_at)
  return new Date(n.starts_at)
}

export function NotificationBell() {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const fetchItems = async () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        id, starts_at, status, cancelled_by, cancelled_at,
        customer:customers!inner(full_name),
        barber:barbers!inner(display_name),
        service:services!inner(name_da)
      `)
      .in('status', ['cancelled', 'no_show'])
      .is('notification_dismissed_at', null)
      .or(`cancelled_at.gte.${sevenDaysAgo},starts_at.gte.${sevenDaysAgo}`)
      .order('cancelled_at', { ascending: false, nullsFirst: false })
      .limit(FETCH_LIMIT)

    if (error || !data) return
    const mapped = (data as unknown as Array<{
      id: string
      starts_at: string
      status: 'cancelled' | 'no_show'
      cancelled_by: string | null
      cancelled_at: string | null
      customer: { full_name: string }
      barber: { display_name: string }
      service: { name_da: string }
    }>).map((r) => ({
      id: r.id,
      starts_at: r.starts_at,
      status: r.status,
      cancelled_by: r.cancelled_by,
      cancelled_at: r.cancelled_at,
      customer_name: r.customer.full_name,
      barber_name: r.barber.display_name,
      service_name: r.service.name_da,
    }))
    setItems(mapped)
  }

  useEffect(() => {
    fetchItems()
    const interval = setInterval(fetchItems, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  // Close on click outside
  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  // Close on ESC
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  const dismissOne = async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
    const { error } = await supabase.rpc('dismiss_notification', { p_booking_id: id })
    if (error) {
      console.error('dismiss_notification failed:', error)
      // Re-sync from server on failure
      fetchItems()
    }
  }

  const dismissAll = async () => {
    setItems([])
    const { error } = await supabase.rpc('dismiss_all_notifications')
    if (error) {
      console.error('dismiss_all_notifications failed:', error)
      fetchItems()
    }
  }

  const unreadCount = items.length
  const badgeText = unreadCount === 0 ? '' : unreadCount > 9 ? '9+' : String(unreadCount)
  const bellColor = unreadCount > 0 ? '#B08A3E' : '#6B5B45'

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={
          unreadCount > 0
            ? `Notifikationer (${unreadCount} ulæste)`
            : 'Notifikationer'
        }
        aria-expanded={open}
        className="relative p-1.5 rounded-md hover:bg-gray-100 transition-colors"
        style={{ color: bellColor }}
      >
        {ICON_BELL}
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 inline-flex items-center justify-center rounded-full text-white"
            style={{
              backgroundColor: '#9A2A2A',
              fontFamily: 'Inter, system-ui, sans-serif',
              fontWeight: 600,
              fontSize: '10px',
              padding: '1px 5px',
              minWidth: '18px',
              lineHeight: '14px',
            }}
            aria-hidden="true"
          >
            {badgeText}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifikationer"
          className="absolute right-0 top-full mt-2 z-50 w-[calc(100vw-2rem)] max-w-[380px] bg-white rounded-2xl shadow-lg overflow-hidden"
          style={{ border: '1px solid #C8B89A', maxHeight: '480px' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-gray-700">
              Notifikationer
            </p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={dismissAll}
                className="text-[12px] hover:underline"
                style={{ color: '#B08A3E' }}
              >
                Markér alle som læst
              </button>
            )}
          </div>

          {/* Body */}
          <div className="overflow-y-auto" style={{ maxHeight: '420px' }}>
            {items.length === 0 ? (
              <p
                className="text-center p-6 text-[14px]"
                style={{ color: '#6B5B45', fontFamily: 'Inter, system-ui, sans-serif' }}
              >
                Ingen notifikationer.
              </p>
            ) : (
              <ul>
                {items.map((n) => {
                  const startsAt = new Date(n.starts_at)
                  const dotColor = n.status === 'cancelled' ? '#9A2A2A' : '#9A8870'
                  return (
                    <li
                      key={n.id}
                      className="flex items-start gap-3 p-3 hover:bg-[#FAFAF8] transition-colors"
                      style={{ borderBottom: '1px solid #E5E5E5' }}
                    >
                      <span
                        className="mt-1.5 flex-shrink-0 inline-block rounded-full"
                        style={{ backgroundColor: dotColor, width: '8px', height: '8px' }}
                        aria-hidden="true"
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-[14px] font-medium truncate"
                          style={{ color: '#2A2118', fontFamily: 'Inter, system-ui, sans-serif' }}
                        >
                          {notificationHeadline(n)}
                        </p>
                        <p
                          className="text-[12px] mt-0.5 leading-snug"
                          style={{ color: '#6B5B45', fontFamily: 'Inter, system-ui, sans-serif' }}
                        >
                          {n.service_name} · {formatBookingDate(startsAt)} {formatBookingTime(startsAt)} hos {n.barber_name} · {relativeDanish(notificationTimestamp(n))}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => dismissOne(n.id)}
                        aria-label="Afvis notifikation"
                        className="flex-shrink-0 p-1 rounded transition-colors"
                        style={{ color: '#6B5B45' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#B08A3E'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = '#6B5B45'
                        }}
                      >
                        {ICON_X_SMALL}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
