import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Card } from '../../components/admin/Card'
import { MonthRangePicker } from '../../components/admin/MonthRangePicker'

interface BookingRow {
  id: string
  price_ore: number
  status: string
  source: string
  starts_at: string
  service: { name_da: string } | null
  barber: { display_name: string } | null
}

function monthsBetween(earliest: Date, today: Date): number {
  const years = today.getFullYear() - earliest.getFullYear()
  const months = today.getMonth() - earliest.getMonth()
  return Math.max(1, years * 12 + months + 1)
}

// "1.250 kr" — Danish thousands separator (period)
function formatDanishKr(ore: number): string {
  const kr = Math.round(ore / 100)
  return `${kr.toLocaleString('da-DK').replace(/,/g, '.')} kr`
}

export function OekonomiPage() {
  const [selectedMonths, setSelectedMonths] = useState(1)
  const [maxMonths, setMaxMonths] = useState(12)
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch earliest booking → maxMonths
  useEffect(() => {
    supabase
      .from('bookings')
      .select('starts_at')
      .order('starts_at', { ascending: true })
      .limit(1)
      .then(({ data }) => {
        const first = (data as { starts_at: string }[] | null)?.[0]
        if (first) {
          setMaxMonths(Math.min(60, monthsBetween(new Date(first.starts_at), new Date())))
        }
      })
  }, [])

  // Fetch bookings for the period
  useEffect(() => {
    let cancelled = false
    setLoading(true)

    const today = new Date()
    const periodStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    periodStart.setMonth(periodStart.getMonth() - selectedMonths)
    const periodEnd = today.toISOString()

    supabase
      .from('bookings')
      .select(`
        id, price_ore, status, source, starts_at,
        service:services(name_da),
        barber:barbers(display_name)
      `)
      .gte('starts_at', periodStart.toISOString())
      .lte('starts_at', periodEnd)
      .neq('status', 'cancelled')
      .order('starts_at', { ascending: false })
      .then(({ data }) => {
        if (cancelled) return
        setBookings((data ?? []) as unknown as BookingRow[])
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [selectedMonths])

  const stats = useMemo(() => {
    const revenueOre = bookings
      .filter((b) => b.status === 'confirmed' || b.status === 'completed')
      .reduce((sum, b) => sum + (b.price_ore ?? 0), 0)
    return {
      revenueOre,
      total: bookings.length,
      online: bookings.filter((b) => b.source === 'web').length,
      phone: bookings.filter((b) => b.source === 'phone').length,
    }
  }, [bookings])

  const perService = useMemo(() => {
    const map = new Map<string, { count: number; revenueOre: number }>()
    for (const b of bookings) {
      const name = b.service?.name_da
      if (!name) continue
      const cur = map.get(name) ?? { count: 0, revenueOre: 0 }
      cur.count += 1
      if (b.status === 'confirmed' || b.status === 'completed') {
        cur.revenueOre += b.price_ore ?? 0
      }
      map.set(name, cur)
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenueOre - a.revenueOre)
  }, [bookings])

  const perBarber = useMemo(() => {
    const map = new Map<string, { count: number; revenueOre: number }>()
    for (const b of bookings) {
      const name = b.barber?.display_name
      if (!name) continue
      const cur = map.get(name) ?? { count: 0, revenueOre: 0 }
      cur.count += 1
      if (b.status === 'confirmed' || b.status === 'completed') {
        cur.revenueOre += b.price_ore ?? 0
      }
      map.set(name, cur)
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenueOre - a.revenueOre)
  }, [bookings])

  return (
    <div className="md:h-full md:overflow-y-auto md:pr-1 space-y-5">
      <div>
        <h1 className="font-serif text-[24px] text-gray-900">Økonomi</h1>
        <p className="text-sm text-gray-500 leading-relaxed mt-1">
          Omsætning og fordeling pr. ydelse og frisør. Vælg en periode for at se data.
        </p>
      </div>

      <Card padding="sm">
        <MonthRangePicker
          value={selectedMonths}
          max={maxMonths}
          onChange={setSelectedMonths}
        />
      </Card>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="i perioden" value={loading ? null : formatDanishKr(stats.revenueOre)} title="Omsætning" />
        <StatCard label="bookinger i alt" value={loading ? null : String(stats.total)} title="Bookinger" />
        <StatCard label="online" value={loading ? null : String(stats.online)} title="Online" />
        <StatCard label="telefon" value={loading ? null : String(stats.phone)} title="Telefon" />
      </div>

      {/* Empty state */}
      {!loading && bookings.length === 0 && (
        <Card padding="lg">
          <p className="text-sm text-gray-500 italic text-center">
            Ingen bookinger i denne periode.
          </p>
        </Card>
      )}

      {/* Per-service breakdown */}
      {!loading && perService.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-900 mb-3">Fordeling på ydelser</h2>
          <Card padding="none">
            <div className="divide-y divide-gray-100">
              {perService.map((s) => (
                <div key={s.name} className="flex items-center px-4 py-3 gap-3">
                  <span className="text-sm text-gray-900 flex-1 min-w-0 truncate">{s.name}</span>
                  <span className="text-xs text-gray-500 w-16 text-center">
                    {s.count} {s.count === 1 ? 'booking' : 'bookinger'}
                  </span>
                  <span className="text-sm font-medium text-[#B08A3E] tabular-nums w-24 text-right">
                    {formatDanishKr(s.revenueOre)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Per-barber breakdown */}
      {!loading && perBarber.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-900 mb-3">Fordeling på frisører</h2>
          <Card padding="none">
            <div className="divide-y divide-gray-100">
              {perBarber.map((b) => (
                <div key={b.name} className="flex items-center px-4 py-3 gap-3">
                  <span className="text-sm text-gray-900 flex-1 min-w-0 truncate">{b.name}</span>
                  <span className="text-xs text-gray-500 w-16 text-center">
                    {b.count} {b.count === 1 ? 'klip' : 'klip'}
                  </span>
                  <span className="text-sm font-medium text-[#B08A3E] tabular-nums w-24 text-right">
                    {formatDanishKr(b.revenueOre)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, title }: { label: string; value: string | null; title: string }) {
  return (
    <Card padding="sm">
      <p className="text-[11px] tracking-[0.08em] uppercase text-gray-400 font-semibold">{title}</p>
      {value === null ? (
        <div className="mt-2 h-7 bg-gray-100 rounded animate-pulse" />
      ) : (
        <p className="font-serif text-[24px] text-gray-900 leading-none mt-1">{value}</p>
      )}
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </Card>
  )
}
