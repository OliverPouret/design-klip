import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { formatDKK } from '../../../utils/revenueUtils'
import type { BookingForKPI } from './KPITileRow'

interface CustomerInsightsProps {
  current: BookingForKPI[]
  start: Date
  end: Date
}

interface CustomerLite {
  id: string
  full_name: string
  first_booking_at: string
}

interface RetentionBookingRow {
  customer_id: string
  starts_at: string
}

const REVENUE_STATUSES = ['confirmed', 'completed']
const DAY_MS = 24 * 60 * 60 * 1000

export function CustomerInsights({ current, start, end }: CustomerInsightsProps) {
  const [customers, setCustomers] = useState<CustomerLite[]>([])
  const [retentionBookings, setRetentionBookings] = useState<RetentionBookingRow[]>([])

  useEffect(() => {
    let cancelled = false
    const customerIds = Array.from(new Set(current.map((b) => b.customer_id).filter(Boolean))) as string[]

    if (customerIds.length === 0) {
      setCustomers([])
      return
    }

    Promise.all([
      supabase.from('customers').select('id, full_name').in('id', customerIds),
      // first-booking lookup (one query): for each customer, fetch their earliest booking
      supabase
        .from('bookings')
        .select('customer_id, starts_at')
        .in('customer_id', customerIds)
        .order('starts_at', { ascending: true }),
      // for retention: 6 months of bookings prior to end
      (() => {
        const retStart = new Date(end)
        retStart.setMonth(retStart.getMonth() - 6)
        return supabase
          .from('bookings')
          .select('customer_id, starts_at')
          .gte('starts_at', retStart.toISOString())
          .lte('starts_at', end.toISOString())
          .in('status', REVENUE_STATUSES)
      })(),
    ]).then(([custRes, firstRes, retRes]) => {
      if (cancelled) return
      const firstByCustomer = new Map<string, string>()
      for (const row of (firstRes.data ?? []) as { customer_id: string; starts_at: string }[]) {
        if (!firstByCustomer.has(row.customer_id)) {
          firstByCustomer.set(row.customer_id, row.starts_at)
        }
      }
      const list = (custRes.data ?? []).map((c: { id: string; full_name: string }) => ({
        id: c.id,
        full_name: c.full_name,
        first_booking_at: firstByCustomer.get(c.id) ?? '',
      }))
      setCustomers(list)
      setRetentionBookings((retRes.data ?? []) as RetentionBookingRow[])
    })

    return () => {
      cancelled = true
    }
  }, [current, end])

  const split = useMemo(() => {
    const startMs = start.getTime()
    let nye = 0
    let gengangere = 0
    const seenInPeriod = new Set<string>()
    for (const b of current) {
      if (!b.customer_id) continue
      if (seenInPeriod.has(b.customer_id)) continue
      seenInPeriod.add(b.customer_id)
      const c = customers.find((x) => x.id === b.customer_id)
      if (!c || !c.first_booking_at) continue
      const firstMs = new Date(c.first_booking_at).getTime()
      if (firstMs >= startMs) nye += 1
      else gengangere += 1
    }
    const total = nye + gengangere
    return {
      nye,
      gengangere,
      nyePct: total > 0 ? Math.round((nye / total) * 100) : 0,
      gengangerePct: total > 0 ? Math.round((gengangere / total) * 100) : 0,
    }
  }, [current, customers, start])

  const retention = useMemo(() => {
    const now = end
    const calcRate = (days: number): number => {
      const windowStart = new Date(now.getTime() - 2 * days * DAY_MS)
      const windowMid = new Date(now.getTime() - days * DAY_MS)
      const cohort = new Map<string, number>()
      for (const b of retentionBookings) {
        const t = new Date(b.starts_at).getTime()
        if (t >= windowStart.getTime() && t < windowMid.getTime()) {
          if (!cohort.has(b.customer_id)) cohort.set(b.customer_id, t)
        }
      }
      if (cohort.size === 0) return 0
      let returned = 0
      for (const [cid, baseT] of cohort) {
        const cutoff = baseT + days * DAY_MS
        const back = retentionBookings.some(
          (rb) =>
            rb.customer_id === cid &&
            new Date(rb.starts_at).getTime() > baseT &&
            new Date(rb.starts_at).getTime() <= cutoff,
        )
        if (back) returned += 1
      }
      return Math.round((returned / cohort.size) * 100)
    }
    return {
      d30: calcRate(30),
      d60: calcRate(60),
      d90: calcRate(90),
    }
  }, [retentionBookings, end])

  const top10 = useMemo(() => {
    const map = new Map<string, { revenue: number; visits: number }>()
    for (const b of current) {
      if (!b.customer_id) continue
      if (b.status === 'cancelled') continue
      const cur = map.get(b.customer_id) ?? { revenue: 0, visits: 0 }
      cur.visits += 1
      if (REVENUE_STATUSES.includes(b.status)) cur.revenue += b.price_ore ?? 0
      map.set(b.customer_id, cur)
    }
    return Array.from(map.entries())
      .map(([id, v]) => {
        const c = customers.find((x) => x.id === id)
        return { id, name: c?.full_name ?? '—', revenue: v.revenue, visits: v.visits }
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
  }, [current, customers])

  return (
    <div>
      <h2 className="text-sm font-medium text-gray-900 mb-3">Kunder</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-[10px] tracking-[0.08em] uppercase text-gray-400 font-semibold mb-3">Nye vs gengangere</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wide">Nye</p>
              <p className="text-[22px] font-semibold text-gray-900 leading-none mt-1">{split.nye}</p>
              <p className="text-xs text-gray-500 mt-1">{split.nyePct}%</p>
            </div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wide">Gengangere</p>
              <p className="text-[22px] font-semibold text-gray-900 leading-none mt-1">{split.gengangere}</p>
              <p className="text-xs text-gray-500 mt-1">{split.gengangerePct}%</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-[10px] tracking-[0.08em] uppercase text-gray-400 font-semibold mb-3">Retention</p>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">30 dage:</span><span className="font-medium text-gray-900 tabular-nums">{retention.d30}%</span></div>
            <div className="flex justify-between"><span className="text-gray-500">60 dage:</span><span className="font-medium text-gray-900 tabular-nums">{retention.d60}%</span></div>
            <div className="flex justify-between"><span className="text-gray-500">90 dage:</span><span className="font-medium text-gray-900 tabular-nums">{retention.d90}%</span></div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-[10px] tracking-[0.08em] uppercase text-gray-400 font-semibold mb-3">Top 10 kunder</p>
          {top10.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Ingen kunder i perioden</p>
          ) : (
            <ol className="text-xs space-y-1.5">
              {top10.map((c, i) => (
                <li key={c.id}>
                  <Link
                    to={`/admin/kunder/${c.id}`}
                    className="flex items-baseline gap-2 hover:bg-gray-50 -mx-1.5 px-1.5 py-0.5 rounded transition-colors"
                  >
                    <span className="text-gray-400 tabular-nums w-5">{i + 1}.</span>
                    <span className="text-gray-900 truncate flex-1">{c.name}</span>
                    <span className="text-gray-700 tabular-nums">{formatDKK(c.revenue)}</span>
                    <span className="text-gray-400">·</span>
                    <span className="text-gray-500 tabular-nums whitespace-nowrap">{c.visits} {c.visits === 1 ? 'besøg' : 'besøg'}</span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  )
}
