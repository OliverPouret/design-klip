import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../lib/auth'
import { RescheduleModal } from './RescheduleModal'

export interface ModalBooking {
  id: string
  starts_at: string
  ends_at: string
  status: string
  source: string
  barber_id: string
  service_id: string
  customer_id: string
  completed_at: string | null
  no_show_marked_at: string | null
  customer: { id: string; full_name: string; phone_e164: string }
  service: { name_da: string }
  barber: { display_name: string; slug: string }
  klipNote?: { body: string } | null
}

interface Props {
  booking: ModalBooking
  onClose: () => void
  // Called after any mutation that changes the booking (complete, no-show,
  // cancel, reschedule, fjern). Parent should refetch its data.
  onChanged: () => void
}

type Action = 'skift_tid' | 'afbestil' | 'markér_fuldført' | 'udeblevet' | 'fjern'

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

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
function endOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}
function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function getAvailableActions(status: string, startsAt: Date, now: Date): Action[] {
  if (status === 'cancelled') return ['fjern']
  if (status === 'completed' || status === 'no_show') return []

  const isToday = isSameDay(startsAt, now)
  const isFuture = startsAt > endOfDay(now)
  const isPast = startsAt < startOfDay(now)

  if (isFuture) return ['skift_tid', 'afbestil']
  if (isToday) return ['skift_tid', 'afbestil', 'markér_fuldført', 'udeblevet']
  if (isPast) return ['markér_fuldført', 'udeblevet']
  return []
}

export function BookingDetailModal({ booking, onClose, onChanged }: Props) {
  const { user } = useAuth()
  const [actionLoading, setActionLoading] = useState(false)
  const [showReschedule, setShowReschedule] = useState(false)
  const [completingMode, setCompletingMode] = useState(false)
  const [completionNote, setCompletionNote] = useState('')
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)

  const startsAt = new Date(booking.starts_at)
  const now = new Date()
  const actions = getAvailableActions(booking.status, startsAt, now)

  const closeAndRefresh = () => {
    onChanged()
    onClose()
  }

  const handleSaveAndComplete = async () => {
    const id = booking.id
    const customerId = booking.customer.id
    const trimmed = completionNote.trim()
    setActionLoading(true)
    try {
      if (trimmed) {
        await supabase.from('customer_notes').insert({
          customer_id: customerId,
          author_id: user?.id ?? null,
          body: trimmed,
          tags: ['klip'],
          booking_id: id,
        })
      }
      await supabase.rpc('mark_booking_completed', { p_booking_id: id })
    } finally {
      setActionLoading(false)
      closeAndRefresh()
    }
  }

  const handleNoShow = async () => {
    if (!confirm('Markér denne booking som udeblevet?')) return
    setActionLoading(true)
    const { error } = await supabase.rpc('mark_booking_no_show', {
      p_booking_id: booking.id,
    })
    setActionLoading(false)
    if (error) {
      console.error('mark_booking_no_show failed:', error)
      return
    }
    closeAndRefresh()
  }

  const handleAdminCancel = async () => {
    if (!confirm('Er du sikker på at du vil afbestille denne booking?')) return
    const id = booking.id
    setActionLoading(true)
    const { error: cancelErr } = await supabase
      .from('bookings')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: 'admin',
      })
      .eq('id', id)

    // Fire shop_cancelled SMS in the background. The customer-side UX is
    // best-effort; we don't block modal close on it.
    if (!cancelErr) {
      fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'cancellation_shop', bookingId: id }),
      }).catch((err) => {
        console.error('shop_cancelled SMS failed:', err)
      })
    }

    setActionLoading(false)
    closeAndRefresh()
  }

  const handleRemoveCancelled = async () => {
    setActionLoading(true)
    const { error } = await supabase.rpc('dismiss_cancelled_booking', {
      p_booking_id: booking.id,
    })
    setActionLoading(false)
    if (error) {
      console.error('dismiss_cancelled_booking failed:', error)
      return
    }
    setShowRemoveConfirm(false)
    closeAndRefresh()
  }

  const completedAt = booking.completed_at ? new Date(booking.completed_at) : null
  const noShowAt = booking.no_show_marked_at ? new Date(booking.no_show_marked_at) : null

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
        <div className="bg-white rounded-lg border border-gray-200 w-full max-w-md overflow-hidden shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
            <h3 className="text-sm font-medium text-gray-900">
              Booking — {booking.customer.full_name}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-700 transition-colors"
              aria-label="Luk"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Status pill — completed / no_show locked states */}
          {booking.status === 'completed' && (
            <div
              className="mx-5 mt-4 rounded-r-lg border-l-4 px-3 py-2 text-[13px] leading-snug"
              style={{
                backgroundColor: '#E3E8D5',
                borderColor: '#5C7A4A',
                color: '#3A5030',
              }}
            >
              <span className="font-semibold">Fuldført</span>
              {completedAt && (
                <>
                  {' '}den {formatDateDanish(completedAt)} {formatTimeDanish(completedAt)} af{' '}
                  {booking.barber.display_name}
                </>
              )}
            </div>
          )}
          {booking.status === 'no_show' && (
            <div
              className="mx-5 mt-4 rounded-r-lg border-l-4 px-3 py-2 text-[13px] leading-snug"
              style={{
                backgroundColor: '#F4F4F4',
                borderColor: '#A89070',
                color: '#2A2118',
              }}
            >
              <span className="font-semibold">Udeblevet</span>
              {noShowAt && (
                <>
                  {' '}— markeret den {formatDateDanish(noShowAt)} {formatTimeDanish(noShowAt)} af{' '}
                  {booking.barber.display_name}
                </>
              )}
            </div>
          )}

          {/* Booking details */}
          <div className="px-5 py-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Ydelse</span>
              <span className="text-gray-900">{booking.service.name_da}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Frisør</span>
              <span className="text-gray-900">{booking.barber.display_name}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-gray-500">Tid</span>
              {actions.includes('skift_tid') && (
                <button
                  onClick={() => setShowReschedule(true)}
                  className="border border-[#B08A3E] text-[#B08A3E] hover:bg-[#B08A3E] hover:text-white text-xs px-3 py-1 rounded transition-colors"
                >
                  Skift tid
                </button>
              )}
              <span className="flex-1" />
              <span className="text-gray-900">
                {new Date(booking.starts_at).toLocaleTimeString('da-DK', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {' — '}
                {new Date(booking.ends_at).toLocaleTimeString('da-DK', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Status</span>
              <span className="text-gray-900 capitalize">{booking.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Telefon</span>
              <a
                href={`tel:${booking.customer.phone_e164}`}
                className="text-[#B08A3E]"
              >
                {booking.customer.phone_e164}
              </a>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-gray-500 flex-shrink-0">Note</span>
              <span
                className={`text-right ${
                  booking.klipNote?.body ? 'text-gray-900' : 'text-gray-400'
                }`}
                title={booking.klipNote?.body || undefined}
              >
                {booking.klipNote?.body
                  ? booking.klipNote.body.length > 80
                    ? `${booking.klipNote.body.slice(0, 80)}…`
                    : booking.klipNote.body
                  : '—'}
              </span>
            </div>
          </div>

          {/* Actions */}
          {actions.length > 0 && (
            <div className="px-5 py-4 border-t border-gray-200 space-y-2">
              {completingMode ? (
                <div className="space-y-3">
                  <textarea
                    value={completionNote}
                    onChange={(e) => setCompletionNote(e.target.value)}
                    placeholder="Hvad blev lavet i dag?"
                    rows={3}
                    autoFocus
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#B08A3E] transition-colors resize-none"
                  />
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleSaveAndComplete}
                      disabled={actionLoading}
                      className="bg-[#B08A3E] hover:bg-[#8C6A28] text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {actionLoading ? 'Gemmer…' : 'Gem og fuldfør'}
                    </button>
                    <button
                      onClick={() => {
                        setCompletingMode(false)
                        setCompletionNote('')
                      }}
                      disabled={actionLoading}
                      className="text-xs text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
                    >
                      Annullér
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {actions.includes('markér_fuldført') && (
                    <button
                      onClick={() => setCompletingMode(true)}
                      disabled={actionLoading}
                      className="w-full py-2.5 bg-[#B08A3E] hover:bg-[#8C6A28] text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                      Markér som fuldført
                    </button>
                  )}
                  {actions.includes('udeblevet') && (
                    <button
                      onClick={handleNoShow}
                      disabled={actionLoading}
                      className="w-full py-2.5 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                      Udeblevet
                    </button>
                  )}
                  {actions.includes('afbestil') && (
                    <button
                      onClick={handleAdminCancel}
                      disabled={actionLoading}
                      className="w-full py-2.5 border border-gray-200 text-gray-500 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      Afbestil booking
                    </button>
                  )}
                  {actions.includes('fjern') && (
                    <button
                      onClick={() => setShowRemoveConfirm(true)}
                      disabled={actionLoading}
                      className="w-full py-2.5 border border-gray-200 text-gray-500 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      Fjern
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Fjern (remove cancelled booking) confirmation overlay */}
      {showRemoveConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[60] flex items-center justify-center px-4"
          style={{ backgroundColor: 'rgba(26,26,26,0.55)' }}
        >
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-serif text-[22px] text-gray-900">Fjern aflyst booking</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              Tidsslottet er allerede frigivet. Bookingen forsvinder fra kalenderen, men
              gemmes i Historik.
            </p>
            <div className="flex flex-wrap justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowRemoveConfirm(false)}
                disabled={actionLoading}
                className="text-[13px] px-4 py-2 rounded-full border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Annullér
              </button>
              <button
                type="button"
                onClick={handleRemoveCancelled}
                disabled={actionLoading}
                className="text-[13px] px-5 py-2 rounded-full bg-[#B08A3E] hover:bg-[#8C6A28] text-white font-semibold transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Fjerner…' : 'Fjern fra kalender'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule modal */}
      {showReschedule && (
        <RescheduleModal
          booking={{
            id: booking.id,
            barber_id: booking.barber_id,
            service_id: booking.service_id,
            starts_at: booking.starts_at,
            ends_at: booking.ends_at,
            customer_name: booking.customer.full_name,
            service_name: booking.service.name_da,
            barber_name: booking.barber.display_name,
          }}
          onClose={() => setShowReschedule(false)}
          onRescheduled={() => {
            setShowReschedule(false)
            closeAndRefresh()
          }}
        />
      )}
    </>
  )
}
