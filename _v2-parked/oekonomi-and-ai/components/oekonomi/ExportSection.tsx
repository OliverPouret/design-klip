import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { downloadCSV } from '../../../utils/csvExport'
import { formatDanishDate, calcMomsFromGross } from '../../../utils/revenueUtils'
import type { BookingForKPI } from './KPITileRow'

interface CustomerNameRow {
  id: string
  full_name: string
  phone_e164: string | null
  email: string | null
  created_at: string
}

interface BarberNameRow {
  id: string
  display_name: string
}

interface ExportSectionProps {
  bookings: BookingForKPI[]
  start: Date
  end: Date
}

const REVENUE_STATUSES = ['confirmed', 'completed']

function fmtDateForFilename(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function ExportSection({ bookings, start, end }: ExportSectionProps) {
  const [customers, setCustomers] = useState<CustomerNameRow[]>([])
  const [barbers, setBarbers] = useState<BarberNameRow[]>([])

  useEffect(() => {
    let cancelled = false
    const customerIds = Array.from(new Set(bookings.map((b) => b.customer_id).filter(Boolean))) as string[]
    const barberIds = Array.from(new Set(bookings.map((b) => b.barber_id).filter(Boolean))) as string[]
    Promise.all([
      customerIds.length
        ? supabase.from('customers').select('id, full_name, phone_e164, email, created_at').in('id', customerIds)
        : Promise.resolve({ data: [] }),
      barberIds.length
        ? supabase.from('barbers').select('id, display_name').in('id', barberIds)
        : Promise.resolve({ data: [] }),
    ]).then(([cRes, bRes]) => {
      if (cancelled) return
      setCustomers((cRes.data ?? []) as CustomerNameRow[])
      setBarbers((bRes.data ?? []) as BarberNameRow[])
    })
    return () => {
      cancelled = true
    }
  }, [bookings])

  const customerName = (id: string | null) => customers.find((c) => c.id === id)?.full_name ?? ''
  const customerPhone = (id: string | null) => customers.find((c) => c.id === id)?.phone_e164 ?? ''
  const barberName = (id: string | null) => barbers.find((b) => b.id === id)?.display_name ?? ''

  const fileSuffix = `${fmtDateForFilename(start)}-til-${fmtDateForFilename(end)}`

  const exportBookings = () => {
    const headers = [
      'dato',
      'tid_start',
      'tid_slut',
      'kunde',
      'telefon',
      'ydelse',
      'frisør',
      'pris_brutto',
      'pris_netto',
      'moms',
      'status',
      'kilde',
      'oprettet_dato',
    ]
    const rows: (string | number)[][] = bookings
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
      .map((b) => {
        const startD = new Date(b.starts_at)
        const endD = b.ends_at ? new Date(b.ends_at) : null
        const moms = calcMomsFromGross(b.price_ore ?? 0)
        const net = (b.price_ore ?? 0) - moms
        return [
          formatDanishDate(startD),
          fmtTime(startD),
          endD ? fmtTime(endD) : '',
          customerName(b.customer_id),
          customerPhone(b.customer_id),
          b.services?.name_da ?? '',
          barberName(b.barber_id),
          (b.price_ore ?? 0) / 100,
          net / 100,
          moms / 100,
          b.status,
          b.source,
          '',
        ]
      })
    downloadCSV(`bookinger-${fileSuffix}.csv`, headers, rows)
  }

  const exportCustomers = () => {
    const headers = [
      'navn',
      'telefon',
      'email',
      'oprettet_dato',
      'antal_besøg',
      'samlet_forbrug_kr',
      'sidste_besøg',
      'gns_pris',
    ]
    const customerStats = new Map<
      string,
      { visits: number; revenue: number; lastVisit: string | null }
    >()
    for (const b of bookings) {
      if (!b.customer_id) continue
      if (b.status === 'cancelled') continue
      const cur = customerStats.get(b.customer_id) ?? { visits: 0, revenue: 0, lastVisit: null }
      cur.visits += 1
      if (REVENUE_STATUSES.includes(b.status)) cur.revenue += b.price_ore ?? 0
      if (!cur.lastVisit || b.starts_at > cur.lastVisit) cur.lastVisit = b.starts_at
      customerStats.set(b.customer_id, cur)
    }
    const rows: (string | number)[][] = Array.from(customerStats.entries()).map(([cid, s]) => {
      const c = customers.find((x) => x.id === cid)
      return [
        c?.full_name ?? '',
        c?.phone_e164 ?? '',
        c?.email ?? '',
        c?.created_at ? formatDanishDate(new Date(c.created_at)) : '',
        s.visits,
        Math.round(s.revenue / 100),
        s.lastVisit ? formatDanishDate(new Date(s.lastVisit)) : '',
        s.visits > 0 ? Math.round(s.revenue / s.visits / 100) : 0,
      ]
    })
    downloadCSV(`kunder-${fileSuffix}.csv`, headers, rows)
  }

  const exportRevenuePerDay = () => {
    const headers = ['dato', 'antal_bookinger', 'brutto_kr', 'moms_kr', 'netto_kr']
    const byDay = new Map<string, { count: number; gross: number }>()
    for (const b of bookings) {
      if (!REVENUE_STATUSES.includes(b.status)) continue
      const d = new Date(b.starts_at)
      const k = dayKey(d)
      const cur = byDay.get(k) ?? { count: 0, gross: 0 }
      cur.count += 1
      cur.gross += b.price_ore ?? 0
      byDay.set(k, cur)
    }
    const rows: (string | number)[][] = Array.from(byDay.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => {
        const moms = calcMomsFromGross(v.gross)
        const net = v.gross - moms
        return [k, v.count, Math.round(v.gross / 100), Math.round(moms / 100), Math.round(net / 100)]
      })
    downloadCSV(`omsaetning-per-dag-${fileSuffix}.csv`, headers, rows)
  }

  return (
    <div>
      <h2 className="text-sm font-medium text-gray-900 mb-1">Eksportér data</h2>
      <p className="text-xs text-gray-500 mb-3">Hent dine data som CSV til regnskab eller egen analyse</p>
      <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={exportBookings}
          className="px-3 py-1.5 text-xs font-medium border border-gray-300 text-gray-700 rounded-md hover:border-[#B08A3E] hover:text-[#B08A3E] transition-colors"
        >
          Bookinger
        </button>
        <button
          type="button"
          onClick={exportCustomers}
          className="px-3 py-1.5 text-xs font-medium border border-gray-300 text-gray-700 rounded-md hover:border-[#B08A3E] hover:text-[#B08A3E] transition-colors"
        >
          Kunder
        </button>
        <button
          type="button"
          onClick={exportRevenuePerDay}
          className="px-3 py-1.5 text-xs font-medium border border-gray-300 text-gray-700 rounded-md hover:border-[#B08A3E] hover:text-[#B08A3E] transition-colors"
        >
          Omsætning per dag
        </button>
      </div>
    </div>
  )
}
