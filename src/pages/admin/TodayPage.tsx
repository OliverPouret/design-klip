import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useBarbers } from '../../hooks/useBarbers'
import { isoWeekday } from '../../lib/danishDates'
import { formatDKK } from '../../types/database'
import { Card } from '../../components/admin/Card'

interface TodayBooking {
  id: string
  starts_at: string
  ends_at: string
  status: string
  source: string
  barber_id: string
  customer: { full_name: string }
  service: { name_da: string; price_ore: number; duration_minutes: number }
  barber: { display_name: string }
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
            service:services!inner(name_da, price_ore, duration_minutes),
            barber:barbers!inner(display_name)
          `)
          .gte('starts_at', dayStart.toISOString())
          .lt('starts_at', dayEnd.toISOString())
          .order('starts_at'),
        supabase.from('barber_hours').select('barber_id, opens_at, closes_at').eq('isoweekday', wd),
        supabase
          .from('time_off')
          .select('barber_id')
          .lte('starts_at', dayEnd.toISOString())
          .gte('ends_at', dayStart.toISOString()),
      ])

      setBookings((bookingsRes.data ?? []) as unknown as TodayBooking[])

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
  const totalRevenueOre = active.reduce((sum, b) => sum + (b.service?.price_ore ?? 0), 0)
  const onlineCount = active.filter((b) => b.source === 'web').length
  const phoneCount = active.filter((b) => b.source === 'phone').length
  const noShowCount = bookings.filter((b) => b.status === 'no_show').length

  // Per-barber stats
  const barberStats = barbers.map((b) => {
    const theirBookings = active.filter((bk) => bk.barber_id === b.id).sort((a, c) => a.starts_at.localeCompare(c.starts_at))
    const hours = barberHours[b.id]
    let totalSlots = 0
    if (hours) {
      const [oH, oM] = hours.opens.split(':').map(Number)
      const [cH, cM] = hours.closes.split(':').map(Number)
      totalSlots = Math.max(0, ((cH * 60 + cM) - (oH * 60 + oM)) / 30)
    }
    const bookedSlots = theirBookings.reduce(
      (sum, bk) => sum + (bk.service?.duration_minutes ?? 0) / 30,
      0,
    )
    const filledRatio = totalSlots > 0 ? Math.min(1, bookedSlots / totalSlots) : 0
    const firstTime = theirBookings[0]
      ? new Date(theirBookings[0].starts_at).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })
      : null
    const lastTime = theirBookings[theirBookings.length - 1]
      ? new Date(theirBookings[theirBookings.length - 1].starts_at).toLocaleTimeString('da-DK', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : null
    return {
      id: b.id,
      name: b.display_name,
      isOff: !hours,
      count: theirBookings.length,
      filledRatio,
      firstTime,
      lastTime,
    }
  })

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="md:h-full md:overflow-y-auto md:pr-1 space-y-6">
      <div>
        <h1 className="font-serif text-[24px] text-gray-900 capitalize">{dayHeading}</h1>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card padding="sm">
          <p className="font-serif text-[26px] text-gray-900 leading-none">{totalBookings}</p>
          <p className="text-xs text-gray-500 mt-1">bookinger i dag</p>
        </Card>
        <Card padding="sm">
          <p className="font-serif text-[26px] text-gray-900 leading-none">{formatDKK(totalRevenueOre)}</p>
          <p className="text-xs text-gray-500 mt-1">forventet omsætning</p>
        </Card>
        <Card padding="sm">
          <p className="font-serif text-[26px] text-gray-900 leading-none">{onlineCount}</p>
          <p className="text-xs text-gray-500 mt-1">online bookinger</p>
        </Card>
        <Card padding="sm">
          <p className="font-serif text-[26px] text-gray-900 leading-none">{phoneCount}</p>
          <p className="text-xs text-gray-500 mt-1">telefonbookinger</p>
        </Card>
        <Card padding="sm">
          <p className="font-serif text-[26px] text-gray-900 leading-none">{noShowCount}</p>
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
                <>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {b.count} {b.count === 1 ? 'klip' : 'klip'} i dag
                  </p>
                  <p className="text-xs text-gray-500">
                    {b.firstTime && b.lastTime
                      ? `${b.firstTime} — ${b.lastTime}`
                      : 'Ingen bookinger'}
                  </p>
                  <div className="mt-2 h-1.5 bg-gray-100 rounded overflow-hidden">
                    <div
                      className="h-full bg-[#B08A3E]"
                      style={{ width: `${Math.round(b.filledRatio * 100)}%` }}
                    />
                  </div>
                </>
              )}
            </Card>
          ))}
        </div>
      </div>

      {/* Booking list */}
      <div>
        <h2 className="text-sm font-medium text-gray-900 mb-3">Dagens bookinger</h2>
        {active.length === 0 ? (
          <Card padding="sm">
            <p className="text-sm text-gray-500 italic">Ingen bookinger i dag.</p>
          </Card>
        ) : (
          <Card padding="none">
            <div className="divide-y divide-gray-100">
              {active.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <span className="text-sm font-medium text-gray-900 w-12 flex-shrink-0">
                    {fmtTime(b.starts_at)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 truncate">{b.customer.full_name}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {b.service.name_da} · {b.barber.display_name}
                    </p>
                  </div>
                  <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-medium">
                    {b.source === 'phone' ? '📞 Telefon' : '🌐 Online'}
                  </span>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wide whitespace-nowrap">
                    {STATUS_LABEL[b.status] ?? b.status}
                  </span>
                </div>
              ))}
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
