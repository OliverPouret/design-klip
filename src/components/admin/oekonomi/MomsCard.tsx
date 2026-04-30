import { useEffect, useMemo, useState } from 'react'
import jsPDF from 'jspdf'
import { supabase } from '../../../lib/supabase'
import { formatDKK, formatDanishDate, calcMomsFromGross } from '../../../utils/revenueUtils'
import { downloadCSV } from '../../../utils/csvExport'
import type { BookingForKPI } from './KPITileRow'

interface MomsCardProps {
  bookings: BookingForKPI[]
  start: Date
  end: Date
}

interface CustomerNameRow {
  id: string
  full_name: string
}

interface BarberNameRow {
  id: string
  display_name: string
}

const REVENUE_STATUSES = ['confirmed', 'completed']

function fmtDateForFilename(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function MomsCard({ bookings, start, end }: MomsCardProps) {
  const [customers, setCustomers] = useState<CustomerNameRow[]>([])
  const [barbers, setBarbers] = useState<BarberNameRow[]>([])

  useEffect(() => {
    let cancelled = false
    const customerIds = Array.from(new Set(bookings.map((b) => b.customer_id).filter(Boolean))) as string[]
    const barberIds = Array.from(new Set(bookings.map((b) => b.barber_id).filter(Boolean))) as string[]
    if (customerIds.length === 0 && barberIds.length === 0) {
      setCustomers([])
      setBarbers([])
      return
    }
    Promise.all([
      customerIds.length
        ? supabase.from('customers').select('id, full_name').in('id', customerIds)
        : Promise.resolve({ data: [] as CustomerNameRow[] }),
      barberIds.length
        ? supabase.from('barbers').select('id, display_name').in('id', barberIds)
        : Promise.resolve({ data: [] as BarberNameRow[] }),
    ]).then(([cRes, bRes]) => {
      if (cancelled) return
      setCustomers((cRes.data ?? []) as CustomerNameRow[])
      setBarbers((bRes.data ?? []) as BarberNameRow[])
    })
    return () => {
      cancelled = true
    }
  }, [bookings])

  const totals = useMemo(() => {
    const eligible = bookings.filter((b) => REVENUE_STATUSES.includes(b.status))
    const gross = eligible.reduce((s, b) => s + (b.price_ore ?? 0), 0)
    const moms = calcMomsFromGross(gross)
    const net = gross - moms
    return { gross, moms, net, count: eligible.length }
  }, [bookings])

  const customerName = (id: string | null) =>
    customers.find((c) => c.id === id)?.full_name ?? '—'
  const barberName = (id: string | null) =>
    barbers.find((b) => b.id === id)?.display_name ?? '—'

  const exportPDF = () => {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text('Moms-rapport — Design Klip', 14, 18)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(`Periode: ${formatDanishDate(start)} – ${formatDanishDate(end)}`, 14, 26)

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Sammenfatning', 14, 38)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    let y = 46
    const summary: [string, string][] = [
      ['Bruttoomsætning', formatDKK(totals.gross)],
      ['Nettoomsætning', formatDKK(totals.net)],
      ['Moms (25%)', formatDKK(totals.moms)],
      ['Antal bookinger', String(totals.count)],
    ]
    for (const [k, v] of summary) {
      doc.text(k, 14, y)
      doc.text(v, pageWidth - 14, y, { align: 'right' })
      y += 6
    }

    y += 4
    doc.setFont('helvetica', 'bold')
    doc.text('Bookinger', 14, y)
    y += 6

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    const cols = ['Dato', 'Kunde', 'Ydelse', 'Brutto', 'Moms', 'Netto']
    const colX = [14, 40, 80, 130, 155, 180]
    cols.forEach((c, i) => doc.text(c, colX[i], y))
    y += 4
    doc.setLineWidth(0.1)
    doc.line(14, y, pageWidth - 14, y)
    y += 4

    doc.setFont('helvetica', 'normal')
    const sorted = [...bookings]
      .filter((b) => REVENUE_STATUSES.includes(b.status))
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    for (const b of sorted) {
      if (y > 280) {
        doc.addPage()
        y = 20
      }
      const d = new Date(b.starts_at)
      const moms = calcMomsFromGross(b.price_ore ?? 0)
      const net = (b.price_ore ?? 0) - moms
      const row = [
        formatDanishDate(d),
        customerName(b.customer_id).slice(0, 22),
        (b.services?.name_da ?? '—').slice(0, 22),
        formatDKK(b.price_ore ?? 0),
        formatDKK(moms),
        formatDKK(net),
      ]
      row.forEach((c, i) => doc.text(c, colX[i], y))
      y += 5
    }

    y += 6
    doc.setFontSize(8)
    doc.setTextColor(120)
    doc.text(`Genereret ${formatDanishDate(new Date())}. Genereret automatisk fra Design Klip booking system.`, 14, Math.min(y, 290))

    doc.save(`moms-rapport-${fmtDateForFilename(start)}-til-${fmtDateForFilename(end)}.pdf`)
  }

  const exportCSV = () => {
    const headers = ['dato', 'tid', 'kunde', 'telefon', 'ydelse', 'frisør', 'brutto', 'moms', 'netto', 'status', 'kilde']
    const rows: (string | number)[][] = bookings
      .filter((b) => REVENUE_STATUSES.includes(b.status))
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
      .map((b) => {
        const d = new Date(b.starts_at)
        const moms = calcMomsFromGross(b.price_ore ?? 0)
        const net = (b.price_ore ?? 0) - moms
        return [
          formatDanishDate(d),
          fmtTime(d),
          customerName(b.customer_id),
          '',
          b.services?.name_da ?? '—',
          barberName(b.barber_id),
          (b.price_ore ?? 0) / 100,
          moms / 100,
          net / 100,
          b.status,
          b.source,
        ]
      })
    downloadCSV(`moms-data-${fmtDateForFilename(start)}-til-${fmtDateForFilename(end)}.csv`, headers, rows)
  }

  return (
    <div>
      <h2 className="text-sm font-medium text-gray-900 mb-3">Moms (25%)</h2>
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <p className="text-sm text-gray-500">
          Moms opkrævet i perioden ({formatDanishDate(start)} – {formatDanishDate(end)}):
        </p>
        <p className="font-serif text-[28px] text-gray-900 leading-none mt-2 text-right">
          {formatDKK(totals.moms)}
        </p>

        <div className="mt-5 border-t border-gray-100 pt-4 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Bruttoomsætning</span>
            <span className="text-gray-900 tabular-nums">{formatDKK(totals.gross)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Nettoomsætning</span>
            <span className="text-gray-900 tabular-nums">{formatDKK(totals.net)}</span>
          </div>
          <div className="flex justify-between font-medium">
            <span className="text-gray-700">Moms (25%)</span>
            <span className="text-[#B08A3E] tabular-nums">{formatDKK(totals.moms)}</span>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportPDF}
            className="px-3 py-1.5 text-xs font-medium border border-[#B08A3E] text-[#B08A3E] rounded-md hover:bg-[#B08A3E] hover:text-white transition-colors"
          >
            Eksportér moms-rapport som PDF
          </button>
          <button
            type="button"
            onClick={exportCSV}
            className="px-3 py-1.5 text-xs font-medium border border-gray-300 text-gray-700 rounded-md hover:border-[#B08A3E] hover:text-[#B08A3E] transition-colors"
          >
            Eksportér som CSV
          </button>
        </div>
      </div>
    </div>
  )
}
