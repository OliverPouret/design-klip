import { useMemo } from 'react'
import { formatDKK } from '../../../utils/revenueUtils'
import type { BookingForKPI } from './KPITileRow'

interface PaymentMethodSplitProps {
  bookings: BookingForKPI[]
}

export function PaymentMethodSplit({ bookings }: PaymentMethodSplitProps) {
  const stats = useMemo(() => {
    const eligible = bookings.filter((b) => b.status !== 'cancelled')
    const total = eligible.length
    const phone = eligible.filter((b) => b.source === 'phone')
    const web = eligible.filter((b) => b.source === 'web')
    const sumRev = (arr: BookingForKPI[]) =>
      arr
        .filter((b) => ['confirmed', 'completed'].includes(b.status))
        .reduce((s, b) => s + (b.price_ore ?? 0), 0)
    return {
      total,
      phone: { count: phone.length, revenue: sumRev(phone) },
      web: { count: web.length, revenue: sumRev(web) },
    }
  }, [bookings])

  const phonePct = stats.total > 0 ? Math.round((stats.phone.count / stats.total) * 100) : 0
  const webPct = stats.total > 0 ? Math.round((stats.web.count / stats.total) * 100) : 0

  return (
    <div>
      <h2 className="text-sm font-medium text-gray-900 mb-3">Bookings — kilde</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-[10px] tracking-[0.08em] uppercase text-gray-400 font-semibold">📞 Telefon</p>
          <p className="font-serif text-[24px] text-gray-900 leading-none mt-2">{stats.phone.count}</p>
          <p className="text-xs text-gray-500 mt-1">{formatDKK(stats.phone.revenue)} · {phonePct}%</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-[10px] tracking-[0.08em] uppercase text-gray-400 font-semibold">🌐 Online</p>
          <p className="font-serif text-[24px] text-gray-900 leading-none mt-2">{stats.web.count}</p>
          <p className="text-xs text-gray-500 mt-1">{formatDKK(stats.web.revenue)} · {webPct}%</p>
        </div>
      </div>

      <div className="mt-3 bg-gray-50 border border-dashed border-gray-200 rounded-lg p-4">
        <p className="text-sm font-medium text-gray-700">
          MobilePay-betalinger kommer snart <span className="italic text-gray-400 font-normal">(under udvikling)</span>
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Når MobilePay ePayment er sat op, vil betalingsmetoder vises her — kontant, kort, MobilePay, gavekort.
        </p>
      </div>
    </div>
  )
}
