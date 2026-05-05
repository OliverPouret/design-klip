import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useBarbers } from '../../hooks/useBarbers'
import { isoWeekday } from '../../lib/danishDates'
// V1: removed — formatDKK no longer used after stripping revenue stat
// import { formatDKK } from '../../types/database'
import { Card } from '../../components/admin/Card'

interface TodayBooking {
  id: string
  starts_at: string
  ends_at: string
  status: string
  source: string
  barber_id: string
  // V1: removed — price_ore no longer rendered on this page
  // price_ore: number
  customer: { full_name: string }
  service: { name_da: string; duration_minutes: number }
  barber: { display_name: string }
  klipNote?: { body: string } | null
}

const WEEKDAYS_DA = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag']
const MONTHS_DA = [
  'januar', 'februar', 'marts', 'april', 'maj', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'december',
]

const STATUS_LABEL: Record<string, string> = {
  confirmed: 'Bekræftet',
  pending: 'Afventer',
  completed: 'Fuldført',
  no_show: 'Udeblevet',
  cancelled: 'Afbestilt',
}

export function TodayPage() {
  const { barbers } = useBarbers()
  const [bookings, setBookings] = useState<TodayBooking[]>([])
  const [barberHours, setBarberHours] = useState<
    Record<string, { opens: string; closes: string } | null>
  >({})
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  const today = new Date()
  const dayHeading = `I dag — ${WEEKDAYS_DA[today.getDay()]} d. ${today.getDate()}. ${MONTHS_DA[today.getMonth()]}`

  useEffect(() => {
    if (barbers.length === 0) return

    const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayEnd.getDate() + 1)
    const wd = isoWeekday(today)

    const fetchData = async () => {
      const [bookingsRes, hoursRes, timeOffRes] = await Promise.all([
        supabase
          .from('bookings')
          .select(`
            id, starts_at, ends_at, status, source, barber_id,
            customer:customers!inner(full_name),
            service:services!inner(name_da, duration_minutes),
            barber:barbers!inner(display_name)
          `)
          .gte('starts_at', dayStart.toISOString())
          .lt('starts_at', dayEnd.toISOString())
          .eq('dismissed_from_calendar', false)
          .order('starts_at'),
        supabase.from('barber_hours').select('barber_id, opens_at, closes_at').eq('isoweekday', wd),
        supabase
          .from('time_off')
          .select('barber_id')
          .lte('starts_at', dayEnd.toISOString())
          .gte('ends_at', dayStart.toISOString()),
      ])

      let bookingList = (bookingsRes.data ?? []) as unknown as TodayBooking[]

      const bookingIds = bookingList.map((b) => b.id)
      if (bookingIds.length > 0) {
        const { data: notes } = await supabase
          .from('customer_notes')
          .select('booking_id, body, created_at')
          .in('booking_id', bookingIds)
          .contains('tags', ['klip'])
          .order('created_at', { ascending: false })
        const noteMap = new Map<string, { body: string }>()
        ;(notes as { booking_id: string; body: string; created_at: string }[] | null)?.forEach(
          (n) => {
            if (!noteMap.has(n.booking_id)) noteMap.set(n.booking_id, { body: n.body })
          },
        )
        bookingList = bookingList.map((b) => ({ ...b, klipNote: noteMap.get(b.id) ?? null }))
      }

      setBookings(bookingList)

      const hMap: Record<string, { opens: string; closes: string } | null> = {}
      ;(
        (hoursRes.data ?? []) as { barber_id: string; opens_at: string | null; closes_at: string | null }[]
      ).forEach((r) => {
        if (r.opens_at && r.closes_at) {
          hMap[r.barber_id] = { opens: r.opens_at.slice(0, 5), closes: r.closes_at.slice(0, 5) }
        }
      })
      ;((timeOffRes.data ?? []) as { barber_id: string }[]).forEach((r) => {
        hMap[r.barber_id] = null
      })
      setBarberHours(hMap)
      setLoading(false)
    }
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barbers, refreshKey])

  // Real-time: any booking change triggers a re-fetch.
  // Requires Realtime enabled on bookings table in Supabase dashboard.
  useEffect(() => {
    const channel = supabase
      .channel('idag-bookings-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => setRefreshKey((k) => k + 1),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  if (loading) return <p className="text-sm text-gray-400">Henter dagens overblik…</p>

  // Stats — only confirmed/pending count toward the day
  const active = bookings.filter((b) => b.status === 'confirmed' || b.status === 'pending')
  const totalBookings = active.length
  // V1: removed — revenue/source split stat cards no longer shown
  // const totalRevenueOre = active.reduce((sum, b) => sum + (b.price_ore ?? 0), 0)
  // const onlineCount = active.filter((b) => b.source === 'web').length
  // const phoneCount = active.filter((b) => b.source === 'phone').length
  const noShowCount = bookings.filter((b) => b.status === 'no_show').length

  // Per-barber stats
  // V1: removed — first/last booking time + utilization progress bar
  const barberStats = barbers.map((b) => {
    const theirBookings = active.filter((bk) => bk.barber_id === b.id)
    const hours = barberHours[b.id]
    return {
      id: b.id,
      name: b.display_name,
      isOff: !hours,
      count: theirBookings.length,
    }
  })

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="md:h-full md:overflow-y-auto md:pr-1 space-y-6">
      <div>
        <h1 className="text-[24px] font-semibold text-gray-900 capitalize">{dayHeading}</h1>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        <Card padding="sm">
          <p className="text-[26px] font-semibold text-gray-900 leading-none">{totalBookings}</p>
          <p className="text-xs text-gray-500 mt-1">bookinger i dag</p>
        </Card>
        {/* V1: removed — forventet omsætning, online bookinger, telefonbookinger */}
        <Card padding="sm">
          <p className="text-[26px] font-semibold text-gray-900 leading-none">{noShowCount}</p>
          <p className="text-xs text-gray-500 mt-1">udeblivelser</p>
        </Card>
      </div>

      {/* Per-barber */}
      <div>
        <h2 className="text-sm font-medium text-gray-900 mb-3">Frisører</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {barberStats.map((b) => (
            <Card key={b.id} padding="sm" className={b.isOff ? 'opacity-60' : ''}>
              <p className="text-sm font-medium text-gray-900">{b.name}</p>
              {b.isOff ? (
                <p className="text-xs text-gray-500 italic mt-1">Fridag</p>
              ) : (
                <p className="text-xs text-gray-500 mt-0.5">
                  {b.count === 0 ? 'Ingen bookinger' : `${b.count} klip i dag`}
                </p>
              )}
            </Card>
          ))}
        </div>
      </div>

      {/* Booking list */}
      <div>
        <h2 className="text-sm font-medium text-gray-900 mb-3">Dagens bookinger</h2>
        {bookings.length === 0 ? (
          <Card padding="sm">
            <p className="text-sm text-gray-500 italic">Ingen bookinger i dag.</p>
          </Card>
        ) : (
          <Card padding="none">
            <div className="divide-y divide-gray-100">
              {bookings.map((b) => {
                const isCancelled = b.status === 'cancelled'
                return (
                <div
                  key={b.id}
                  className="flex items-start gap-3 px-4 py-3"
                  style={isCancelled ? { backgroundColor: '#F4F4F4', borderLeft: '3px solid #9A2A2A' } : undefined}
                >
                  <span
                    className="text-sm font-medium w-12 flex-shrink-0 mt-0.5"
                    style={isCancelled ? { color: '#9A8870' } : { color: '#111827' }}
                  >
                    {fmtTime(b.starts_at)}
                  </span>
                  <div className="flex-1 min-w-0">
                    {isCancelled && (
                      <p
                        className="font-serif-sc text-[10px] tracking-[0.18em] uppercase mb-0.5"
                        style={{ color: '#9A2A2A' }}
                      >
                        Aflyst
                      </p>
                    )}
                    <p
                      className={`text-sm truncate ${isCancelled ? 'line-through' : ''}`}
                      style={isCancelled ? { color: '#9A8870' } : { color: '#111827' }}
                    >
                      {b.customer.full_name}
                    </p>
                    <p
                      className="text-xs truncate"
                      style={isCancelled ? { color: '#9A8870' } : { color: '#6B7280' }}
                    >
                      {b.service.name_da} · {b.barber.display_name}
                    </p>
                    <p
                      className="text-xs truncate mt-0.5"
                      style={isCancelled ? { color: '#9A8870' } : { color: '#6B7280' }}
                    >
                      Note:{b.klipNote?.body ? ` ${b.klipNote.body}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 mt-0.5">
                    <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-medium">
                      {b.source === 'phone' ? '📞 Telefon' : '🌐 Online'}
                    </span>
                    <span className="text-[10px] text-gray-400 uppercase tracking-wide whitespace-nowrap">
                      {STATUS_LABEL[b.status] ?? b.status}
                    </span>
                  </div>
                </div>
                )
              })}
            </div>
          </Card>
        )}
      </div>

      {/* Quick action */}
      <div>
        <Link
          to="/admin/opret-booking"
          className="inline-block px-5 py-2.5 bg-[#B08A3E] hover:bg-[#8C6A28] text-white text-sm font-medium rounded-lg transition-colors"
        >
          Opret telefonbooking →
        </Link>
      </div>
    </div>
  )
}
