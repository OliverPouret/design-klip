import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  BookingDetailModal,
  type ModalBooking,
} from '../../components/admin/booking/BookingDetailModal'

type StatusKey = 'completed' | 'cancelled' | 'no_show' | 'dismissed'
type RangeKey = '7' | '30' | '90' | 'all'

interface HistorikRow {
  id: string
  starts_at: string
  ends_at: string
  status: string
  cancelled_at: string | null
  cancelled_by: string | null
  no_show_marked_at: string | null
  completed_at: string | null
  dismissed_from_calendar: boolean
  duration_minutes: number
  source: string
  barber_id: string
  service_id: string
  customer_id: string
  customer: {
    id: string
    full_name: string
    phone_e164: string
  }
  service: { name_da: string }
  barber: { display_name: string; slug: string }
}

const WEEKDAY_FULL = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag']
const MONTH_FULL = [
  'januar', 'februar', 'marts', 'april', 'maj', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'december',
]

function formatDateDanish(d: Date): string {
  return `${WEEKDAY_FULL[d.getDay()]} d. ${d.getDate()}. ${MONTH_FULL[d.getMonth()]}`
}
function formatTimeDanish(d: Date): string {
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
  if (days < 30) return `for ${Math.round(days / 7)} ${Math.round(days / 7) === 1 ? 'uge' : 'uger'} siden`
  return `for ${Math.round(days / 30)} ${Math.round(days / 30) === 1 ? 'måned' : 'måneder'} siden`
}

interface StatusMeta {
  key: StatusKey
  label: string
  dot: string
  pillBg: string
  pillColor: string
  verb: string
}

const STATUS_META: Record<StatusKey, StatusMeta> = {
  completed: {
    key: 'completed',
    label: 'Fuldført',
    dot: '#5C7A4A',
    pillBg: '#E3E8D5',
    pillColor: '#3A5030',
    verb: 'fuldført',
  },
  cancelled: {
    key: 'cancelled',
    label: 'Aflyst',
    dot: '#9A2A2A',
    pillBg: '#EFD8D2',
    pillColor: '#9A2A2A',
    verb: 'aflyst',
  },
  no_show: {
    key: 'no_show',
    label: 'Udeblevet',
    dot: '#A89070',
    pillBg: '#F4F4F4',
    pillColor: '#6B5B45',
    verb: 'markeret udeblevet',
  },
  dismissed: {
    key: 'dismissed',
    label: 'Fjernet',
    dot: '#C8B89A',
    pillBg: '#F4F4F4',
    pillColor: '#9A2A2A',
    verb: 'fjernet',
  },
}

const RANGE_DAYS: Record<RangeKey, number | null> = {
  '7': 7,
  '30': 30,
  '90': 90,
  all: null,
}
const RANGE_LABELS: Record<RangeKey, string> = {
  '7': 'Sidste 7 dage',
  '30': 'Sidste 30 dage',
  '90': 'Sidste 90 dage',
  all: 'Alle',
}

function rowStatusKey(row: HistorikRow): StatusKey {
  if (row.status === 'cancelled' && row.dismissed_from_calendar) return 'dismissed'
  if (row.status === 'cancelled') return 'cancelled'
  if (row.status === 'no_show') return 'no_show'
  return 'completed'
}

function rowTimestamp(row: HistorikRow): Date {
  const candidates = [
    row.no_show_marked_at,
    row.cancelled_at,
    row.completed_at,
    row.starts_at,
  ].filter((s): s is string => Boolean(s))
  return candidates.length === 0
    ? new Date(row.starts_at)
    : new Date(Math.max(...candidates.map((s) => new Date(s).getTime())))
}

const PAGE_SIZES = [100, 250, 500] as const

export function HistorikPage() {
  const [rows, setRows] = useState<HistorikRow[]>([])
  const [loading, setLoading] = useState(true)
  const [activeStatuses, setActiveStatuses] = useState<Set<StatusKey>>(new Set())
  const [range, setRange] = useState<RangeKey>('30')
  const [searchInput, setSearchInput] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [limit, setLimit] = useState<number>(PAGE_SIZES[0])
  const [openBooking, setOpenBooking] = useState<ModalBooking | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  // Debounce the customer name search by 300ms.
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const days = RANGE_DAYS[range]
    const since = days
      ? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
      : null

    let query = supabase
      .from('bookings')
      .select(`
        id, starts_at, ends_at, status, cancelled_at, cancelled_by,
        no_show_marked_at, completed_at, dismissed_from_calendar,
        duration_minutes, source, barber_id, service_id, customer_id,
        customer:customers!inner(id, full_name, phone_e164),
        service:services!inner(name_da),
        barber:barbers!inner(display_name, slug)
      `)
      // Historik shows everything that has reached a terminal state. Live
      // cancellations stay in Kalender until the shop dismisses them with
      // "Fjern" — at which point dismissed_from_calendar flips and the row
      // surfaces here.
      .or(
        'status.eq.completed,status.eq.no_show,and(status.eq.cancelled,dismissed_from_calendar.eq.true)',
      )
      .order('starts_at', { ascending: false })
      .limit(limit)

    if (since) query = query.gte('starts_at', since)
    if (searchDebounced) {
      query = query.ilike('customer.full_name', `%${searchDebounced}%`)
    }

    query.then(({ data, error }) => {
      if (cancelled) return
      if (error) {
        console.error('Historik query failed:', error)
        setRows([])
        setLoading(false)
        return
      }
      setRows((data ?? []) as unknown as HistorikRow[])
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [range, searchDebounced, limit, refreshKey])

  const toggleStatus = (key: StatusKey) => {
    setActiveStatuses((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const filtered = useMemo(() => {
    if (activeStatuses.size === 0) return rows
    return rows.filter((r) => activeStatuses.has(rowStatusKey(r)))
  }, [rows, activeStatuses])

  // The query orders by starts_at; re-sort by the most recent terminal
  // timestamp so a booking marked complete this morning beats a booking
  // marked complete last week, even if the latter's starts_at was later.
  const sorted = useMemo(
    () =>
      [...filtered].sort(
        (a, b) => rowTimestamp(b).getTime() - rowTimestamp(a).getTime(),
      ),
    [filtered],
  )

  const handleRowClick = (row: HistorikRow) => {
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

  const canShowMore = sorted.length >= limit && limit < PAGE_SIZES[PAGE_SIZES.length - 1]

  const expandLimit = () => {
    const idx = PAGE_SIZES.indexOf(limit as (typeof PAGE_SIZES)[number])
    const next = PAGE_SIZES[Math.min(idx + 1, PAGE_SIZES.length - 1)]
    setLimit(next)
  }

  return (
    <div className="space-y-4 md:h-full md:overflow-y-auto md:pr-1">
      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(STATUS_META) as StatusKey[]).map((key) => {
            const meta = STATUS_META[key]
            const active = activeStatuses.has(key)
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleStatus(key)}
                aria-pressed={active}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors`}
                style={
                  active
                    ? {
                        backgroundColor: meta.pillBg,
                        borderColor: meta.dot,
                        color: meta.pillColor,
                      }
                    : {
                        backgroundColor: '#FFFFFF',
                        borderColor: '#E5E5E5',
                        color: '#6B5B45',
                      }
                }
              >
                <span
                  className="inline-block rounded-full"
                  style={{
                    backgroundColor: meta.dot,
                    width: '8px',
                    height: '8px',
                  }}
                  aria-hidden="true"
                />
                {meta.label}
              </button>
            )
          })}
          {activeStatuses.size === 0 && (
            <span className="text-xs self-center" style={{ color: '#9A8870' }}>
              Alle
            </span>
          )}
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(RANGE_DAYS) as RangeKey[]).map((key) => {
              const active = range === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setRange(key)}
                  aria-pressed={active}
                  className="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
                  style={
                    active
                      ? { backgroundColor: '#1A1A1A', borderColor: '#1A1A1A', color: '#FFFFFF' }
                      : { backgroundColor: '#FFFFFF', borderColor: '#E5E5E5', color: '#6B5B45' }
                  }
                >
                  {RANGE_LABELS[key]}
                </button>
              )
            })}
          </div>
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Søg kunde…"
            className="md:ml-auto md:w-64 border border-gray-200 rounded-md px-3 py-1.5 text-sm outline-none focus:border-[#B08A3E] transition-colors"
          />
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-sm text-gray-400">Henter historik…</p>
        ) : sorted.length === 0 ? (
          <p
            className="p-8 text-center text-[14px]"
            style={{ color: '#6B5B45', fontFamily: 'Inter, system-ui, sans-serif' }}
          >
            Ingen bookinger matcher filteret.
          </p>
        ) : (
          <ul>
            {sorted.map((row) => {
              const meta = STATUS_META[rowStatusKey(row)]
              const startsAt = new Date(row.starts_at)
              const ts = rowTimestamp(row)
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => handleRowClick(row)}
                    className="w-full text-left flex items-center gap-3 p-4 transition-colors"
                    style={{ borderBottom: '1px solid #E5E5E5' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#FAFAF8'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                  >
                    <span
                      className="inline-block rounded-full flex-shrink-0"
                      style={{ backgroundColor: meta.dot, width: '10px', height: '10px' }}
                      aria-hidden="true"
                    />
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium flex-shrink-0"
                      style={{ backgroundColor: meta.pillBg, color: meta.pillColor }}
                    >
                      {meta.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-[14px] font-medium truncate"
                        style={{ color: '#2A2118', fontFamily: 'Inter, system-ui, sans-serif' }}
                      >
                        {row.customer.full_name} · {row.service.name_da}
                      </p>
                      <p
                        className="text-[12px] mt-0.5 leading-snug truncate"
                        style={{ color: '#6B5B45', fontFamily: 'Inter, system-ui, sans-serif' }}
                      >
                        {row.barber.display_name} · {formatDateDanish(startsAt)}{' '}
                        {formatTimeDanish(startsAt)} · {meta.verb} {relativeDanish(ts)}
                      </p>
                    </div>
                    <span
                      className="text-[12px] flex-shrink-0"
                      style={{ color: '#B08A3E' }}
                      aria-hidden="true"
                    >
                      Vis booking →
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {canShowMore && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={expandLimit}
            className="rounded-full border border-gray-200 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Vis flere
          </button>
        </div>
      )}

      {openBooking && (
        <BookingDetailModal
          booking={openBooking}
          onClose={() => setOpenBooking(null)}
          onChanged={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  )
}
