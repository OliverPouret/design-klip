import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import {
  BookingDetailModal,
  type ModalBooking,
} from '../booking/BookingDetailModal'
import { liveStatusMeta } from '../statusMeta'
import { relativeDanish } from '../../../utils/danishRelative'

interface RecentBookingRow {
  id: string
  starts_at: string
  ends_at: string
  status: string
  source: string
  barber_id: string
  service_id: string
  customer_id: string
  created_at: string
  completed_at: string | null
  no_show_marked_at: string | null
  dismissed_from_calendar: boolean
  customer: { id: string; full_name: string; phone_e164: string }
  service: { name_da: string }
  barber: { display_name: string; slug: string }
}

interface RecentBookingsListProps {
  limit?: number
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function RecentBookingsList({ limit = 5 }: RecentBookingsListProps) {
  const [rows, setRows] = useState<RecentBookingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [openBooking, setOpenBooking] = useState<ModalBooking | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    supabase
      .from('bookings')
      .select(
        `id, starts_at, ends_at, status, source, barber_id, service_id, customer_id,
         created_at, completed_at, no_show_marked_at, dismissed_from_calendar,
         customer:customers!inner(id, full_name, phone_e164),
         service:services!inner(name_da),
         barber:barbers!inner(display_name, slug)`,
      )
      .order('created_at', { ascending: false })
      .limit(limit)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error('RecentBookingsList query failed:', error)
          setRows([])
          setLoading(false)
          return
        }
        setRows((data ?? []) as unknown as RecentBookingRow[])
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [limit, refreshKey])

  const handleClick = (row: RecentBookingRow) => {
    setOpenBooking({
      id: row.id,
      starts_at: row.starts_at,
      ends_at: row.ends_at,
      status: row.status,
      source: row.source,
      barber_id: row.barber_id,
      service_id: row.service_id,
      customer_id: row.customer_id,
      completed_at: row.completed_at,
      no_show_marked_at: row.no_show_marked_at,
      customer: row.customer,
      service: row.service,
      barber: row.barber,
      klipNote: null,
    })
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h3 className="font-serif text-[20px] text-ink leading-tight">Seneste bookinger</h3>
        <Link
          to="/admin/historik"
          className="text-[12px] font-medium transition-colors"
          style={{ color: '#8C6A28' }}
        >
          Se alle →
        </Link>
      </div>

      {loading ? (
        <div className="p-5 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="p-8 text-center text-[14px] text-gray-400">
          Ingen bookinger endnu.
        </p>
      ) : (
        <ul>
          {rows.map((row) => {
            const meta = liveStatusMeta(row.status, row.dismissed_from_calendar)
            const created = new Date(row.created_at)
            return (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => handleClick(row)}
                  className="w-full text-left flex items-center gap-3 px-5 py-3 transition-colors hover:bg-gray-50"
                  style={{ borderBottom: '1px solid #F1F1F1' }}
                >
                  <div
                    className="h-9 w-9 flex-shrink-0 rounded-full flex items-center justify-center text-[12px] font-medium"
                    style={{
                      backgroundColor: '#FFF',
                      color: '#8C6A28',
                      boxShadow: 'inset 0 0 0 2px #B08A3E',
                    }}
                    aria-hidden="true"
                  >
                    {initials(row.customer.full_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-ink truncate">
                      {row.customer.full_name}{' '}
                      <span className="text-gray-400 font-normal">
                        · {relativeDanish(created)}
                      </span>
                    </p>
                    <p className="text-[12px] text-gray-500 truncate mt-0.5">
                      {row.service.name_da} · hos {row.barber.display_name}
                    </p>
                  </div>
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium flex-shrink-0"
                    style={{ backgroundColor: meta.pillBg, color: meta.pillColor }}
                  >
                    {meta.label}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {openBooking && (
        <BookingDetailModal
          booking={openBooking}
          onClose={() => setOpenBooking(null)}
          onChanged={() => {
            setRefreshKey((k) => k + 1)
            setOpenBooking(null)
          }}
        />
      )}
    </div>
  )
}
