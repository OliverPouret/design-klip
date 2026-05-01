// Z-rapport (end-of-day cash-up).
// Bogføringslov 2024 kompliance — denne rapport bør gemmes i 5 år ifølge SKATs regler.

import { useEffect, useState } from 'react'
import jsPDF from 'jspdf'
import { supabase } from '../../../lib/supabase'
import { formatDKK, formatDanishDate, calcMomsFromGross } from '../../../utils/revenueUtils'

interface ZBooking {
  starts_at: string
  status: string
  price_ore: number
  customer_id: string | null
  service_id: string | null
  barber_id: string | null
  services: { name_da: string } | null
  customer: { full_name: string } | null
  barber: { display_name: string } | null
}

const REVENUE_STATUSES = ['confirmed', 'completed']

function fmtDateForFilename(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const STATUS_LABEL: Record<string, string> = {
  confirmed: 'Bekræftet',
  pending: 'Afventer',
  completed: 'Fuldført',
  no_show: 'Udeblevet',
  cancelled: 'Afbestilt',
}

export function ZRapportButton() {
  const [todayCount, setTodayCount] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    const today = new Date()
    const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0)
    const dayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999)
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .gte('starts_at', dayStart.toISOString())
      .lte('starts_at', dayEnd.toISOString())
      .neq('status', 'cancelled')
      .then((res) => {
        if (cancelled) return
        setTodayCount(res.count ?? 0)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const generate = async () => {
    const today = new Date()
    const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0)
    const dayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999)

    const { data } = await supabase
      .from('bookings')
      .select(
        'starts_at, status, price_ore, customer_id, service_id, barber_id, services(name_da), customer:customers(full_name), barber:barbers(display_name)',
      )
      .gte('starts_at', dayStart.toISOString())
      .lte('starts_at', dayEnd.toISOString())
      .order('starts_at')

    const bookings = (data ?? []) as unknown as ZBooking[]
    const eligible = bookings.filter((b) => REVENUE_STATUSES.includes(b.status))
    const gross = eligible.reduce((s, b) => s + (b.price_ore ?? 0), 0)
    const moms = calcMomsFromGross(gross)
    const net = gross - moms

    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text('Z-RAPPORT — Design Klip', 14, 18)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(`Dato: ${formatDanishDate(today)}`, 14, 26)
    const stamp = `${formatDanishDate(today)} ${fmtTime(today)}`
    doc.text(`Genereret: ${stamp}`, 14, 32)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('Sammenfatning', 14, 44)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    let y = 52
    const summary: [string, string][] = [
      ['Antal bookinger', String(eligible.length)],
      ['Bruttoomsætning', formatDKK(gross)],
      ['Moms (25%)', formatDKK(moms)],
      ['Nettoomsætning', formatDKK(net)],
    ]
    for (const [k, v] of summary) {
      doc.text(k, 14, y)
      doc.text(v, pageWidth - 14, y, { align: 'right' })
      y += 6
    }

    y += 4
    doc.setFont('helvetica', 'bold')
    doc.text('Bookinger i dag', 14, y)
    y += 6

    doc.setFontSize(8)
    const cols = ['Tid', 'Kunde', 'Ydelse', 'Frisør', 'Brutto', 'Status']
    const colX = [14, 30, 75, 120, 155, 180]
    cols.forEach((c, i) => doc.text(c, colX[i], y))
    y += 4
    doc.setLineWidth(0.1)
    doc.line(14, y, pageWidth - 14, y)
    y += 4

    doc.setFont('helvetica', 'normal')
    for (const b of bookings) {
      if (y > 280) {
        doc.addPage()
        y = 20
      }
      const d = new Date(b.starts_at)
      const row = [
        fmtTime(d),
        (b.customer?.full_name ?? '—').slice(0, 24),
        (b.services?.name_da ?? '—').slice(0, 22),
        (b.barber?.display_name ?? '—').slice(0, 16),
        formatDKK(b.price_ore ?? 0),
        STATUS_LABEL[b.status] ?? b.status,
      ]
      row.forEach((c, i) => doc.text(c, colX[i], y))
      y += 5
    }

    y += 6
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('TOTAL', 14, y)
    doc.text(formatDKK(gross), pageWidth - 14, y, { align: 'right' })

    y += 10
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(120)
    doc.text(
      'Genereret automatisk · Design Klip booking system · CVR placeholder',
      14,
      Math.min(y, 290),
    )

    doc.save(`z-rapport-${fmtDateForFilename(today)}.pdf`)
  }

  return (
    <div className="border-t border-gray-100 pt-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm font-medium text-gray-900">Z-rapport</p>
          <p className="text-xs text-gray-500 mt-0.5">
            End-of-day kasseopgørelse for i dag
            {todayCount !== null && ` · ${todayCount} ${todayCount === 1 ? 'booking' : 'bookinger'}`}
          </p>
        </div>
        <button
          type="button"
          onClick={generate}
          className="px-3 py-1.5 text-xs font-medium border border-[#B08A3E] text-[#B08A3E] rounded-md hover:bg-[#B08A3E] hover:text-white transition-colors"
        >
          Generér Z-rapport for i dag
        </button>
      </div>
    </div>
  )
}
