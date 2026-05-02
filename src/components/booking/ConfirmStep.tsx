import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatDateLong, formatTime } from '../../lib/danishDates'
import { formatDKK } from '../../types/database'
import { useServices } from '../../hooks/useServices'
import { useBarbers } from '../../hooks/useBarbers'
import type { BookingState } from '../../pages/BookingPage'
import type { CustomerInfo } from './CustomerStep'

export function ConfirmStep({
  state,
  customer,
}: {
  state: BookingState
  customer: CustomerInfo
}) {
  const navigate = useNavigate()
  const { services } = useServices()
  const { barbers } = useBarbers()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const service = services.find((s) => s.slug === state.serviceSlug)
  const barber = state.anyBarber ? null : barbers.find((b) => b.slug === state.barberSlug)

  const handleBook = async () => {
    if (!service || !state.startsAt || !state.resolvedBarberId) return
    setLoading(true)
    setError(null)

    const { data, error: rpcError } = await supabase.rpc('create_booking', {
      p_phone: customer.phone,
      p_full_name: customer.fullName,
      p_email: customer.email || null,
      p_notes: customer.notes || null,
      p_barber_id: state.resolvedBarberId,
      p_service_id: service.id,
      p_starts_at: state.startsAt,
      // V1: marketing-SMS consent disabled until V2 — see /agency/v2-roadmap/.
      // The DB column is preserved; we always pass false in V1.
      p_marketing_opt_in: false,
    })

    setLoading(false)

    if (rpcError) {
      if (rpcError.message?.includes('slot_taken')) {
        setError('Den valgte tid er desværre netop blevet taget. Gå tilbage og vælg et andet tidspunkt.')
      } else {
        setError('Der opstod en fejl. Prøv igen om et øjeblik.')
      }
      return
    }

    const shortCode = Array.isArray(data) ? data[0]?.short_code : data?.short_code
    const bookingIdForSms = Array.isArray(data) ? data[0]?.booking_id : data?.booking_id

    if (shortCode) {
      // Fire-and-forget — booking is already confirmed, don't block on SMS delivery
      if (bookingIdForSms) {
        fetch('/api/send-sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'confirmation', bookingId: bookingIdForSms }),
        }).catch(() => {})
      }
      navigate(`/bestil/bekraeftet/${shortCode}`)
    }
  }

  if (!service || !state.startsAt) return null

  return (
    <div>
      <h2 className="font-serif text-display-md text-ink text-center mb-2">
        Bekræft din tid
      </h2>
      <p className="text-center text-sm text-ink-muted mb-8">
        Tjek at det hele er rigtigt, og tryk bekræft
      </p>

      {/* Summary */}
      <div className="border border-border rounded-sm divide-y divide-border mb-8">
        <div className="flex justify-between px-4 py-3">
          <span className="text-sm text-ink-muted">Ydelse</span>
          <span className="text-sm text-ink font-medium">{service.name_da}</span>
        </div>
        <div className="flex justify-between px-4 py-3">
          <span className="text-sm text-ink-muted">Pris</span>
          <span className="text-sm text-ink font-medium">{formatDKK(service.price_ore)}</span>
        </div>
        <div className="flex justify-between px-4 py-3">
          <span className="text-sm text-ink-muted">Frisør</span>
          <span className="text-sm text-ink font-medium">
            {state.anyBarber ? 'Første ledige' : barber?.display_name}
          </span>
        </div>
        <div className="flex justify-between px-4 py-3">
          <span className="text-sm text-ink-muted">Dato</span>
          <span className="text-sm text-ink font-medium">
            {formatDateLong(new Date(state.startsAt))}
          </span>
        </div>
        <div className="flex justify-between px-4 py-3">
          <span className="text-sm text-ink-muted">Tidspunkt</span>
          <span className="text-sm text-ink font-medium">
            {formatTime(new Date(state.startsAt))}
          </span>
        </div>
        <div className="flex justify-between px-4 py-3">
          <span className="text-sm text-ink-muted">Navn</span>
          <span className="text-sm text-ink font-medium">{customer.fullName}</span>
        </div>
        <div className="flex justify-between px-4 py-3">
          <span className="text-sm text-ink-muted">Mobil</span>
          <span className="text-sm text-ink font-medium">{customer.phone}</span>
        </div>
        {customer.notes && (
          <div className="flex justify-between px-4 py-3">
            <span className="text-sm text-ink-muted">Besked</span>
            <span className="text-sm text-ink font-medium text-right max-w-[60%]">{customer.notes}</span>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-sm">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <button
        onClick={handleBook}
        disabled={loading}
        className="w-full py-4 bg-accent text-white text-sm font-medium tracking-[0.08em] uppercase hover:bg-accent-deep transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? 'Booker…' : 'Bekræft booking'}
      </button>

      <p className="text-xs text-ink-subtle text-center mt-4">
        Du modtager en SMS-bekræftelse med et afbestillingslink
      </p>
    </div>
  )
}
