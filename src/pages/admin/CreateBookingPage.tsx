import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useServices } from '../../hooks/useServices'
import { useBarbers } from '../../hooks/useBarbers'
import { formatDKK } from '../../types/database'
import { formatDateLong, formatTimeShort, isoDate } from '../../lib/danishDates'

interface Slot {
  slot_starts_at: string
  available_barber_ids: string[]
}

export function CreateBookingPage() {
  const navigate = useNavigate()
  const { services } = useServices()
  const { barbers } = useBarbers()

  const [serviceId, setServiceId] = useState<string | null>(null)
  const [barberId, setBarberId] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [slots, setSlots] = useState<Slot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDatePick = async (date: Date) => {
    setSelectedDate(date)
    setSelectedSlot(null)
    if (!serviceId) return
    setLoadingSlots(true)
    const { data } = await supabase.rpc('get_available_slots', {
      p_barber_id: barberId || null,
      p_service_id: serviceId,
      p_date: isoDate(date),
    })
    setSlots((data as Slot[] | null) ?? [])
    setLoadingSlots(false)
  }

  const handleSubmit = async () => {
    if (!serviceId || !selectedSlot || !customerName.trim() || !customerPhone.trim()) return
    setSubmitting(true)
    setError(null)

    const resolvedBarberId =
      barberId || slots.find((s) => s.slot_starts_at === selectedSlot)?.available_barber_ids[0]

    const { data, error: rpcError } = await supabase.rpc('create_booking', {
      p_phone: customerPhone,
      p_full_name: customerName,
      p_email: null,
      p_notes: notes || null,
      p_barber_id: resolvedBarberId,
      p_service_id: serviceId,
      p_starts_at: selectedSlot,
      p_marketing_opt_in: false,
    })

    setSubmitting(false)

    if (rpcError) {
      if (rpcError.message?.includes('slot_taken')) {
        setError('Tiden er netop blevet taget. Vælg en anden tid.')
      } else {
        setError('Der opstod en fejl. Prøv igen.')
      }
      return
    }

    const bookingId = Array.isArray(data) ? data[0]?.booking_id : (data as { booking_id?: string } | null)?.booking_id
    if (bookingId) {
      await supabase.from('bookings').update({ source: 'phone' }).eq('id', bookingId)
    }

    navigate('/admin/i-dag')
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <div>
      <h1 className="font-serif text-xl text-ink mb-6">Opret telefonbooking</h1>

      <div className="bg-white border border-border rounded-sm p-6 space-y-6">
        {/* Service */}
        <div>
          <label className="block text-xs tracking-[0.08em] uppercase text-ink-subtle mb-2">Ydelse</label>
          <div className="grid grid-cols-1 gap-2">
            {services.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setServiceId(s.id)
                  setSelectedSlot(null)
                  setSlots([])
                }}
                className={`text-left px-3 py-2.5 border rounded-sm text-sm transition-colors ${
                  serviceId === s.id ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/50'
                }`}
              >
                {s.name_da} — {formatDKK(s.price_ore)} ({s.duration_minutes} min)
              </button>
            ))}
          </div>
        </div>

        {/* Barber */}
        {serviceId && (
          <div>
            <label className="block text-xs tracking-[0.08em] uppercase text-ink-subtle mb-2">Frisør</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setBarberId(null)
                  setSelectedSlot(null)
                  setSlots([])
                }}
                className={`text-left px-3 py-2.5 border rounded-sm text-sm transition-colors ${
                  barberId === null ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/50'
                }`}
              >
                Første ledige
              </button>
              {barbers.map((b) => (
                <button
                  key={b.id}
                  onClick={() => {
                    setBarberId(b.id)
                    setSelectedSlot(null)
                    setSlots([])
                  }}
                  className={`text-left px-3 py-2.5 border rounded-sm text-sm transition-colors ${
                    barberId === b.id ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/50'
                  }`}
                >
                  {b.display_name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Date — quick 14-day pick */}
        {serviceId && (
          <div>
            <label className="block text-xs tracking-[0.08em] uppercase text-ink-subtle mb-2">Dato</label>
            <div className="flex gap-2 flex-wrap">
              {Array.from({ length: 14 }, (_, i) => {
                const d = new Date(today)
                d.setDate(today.getDate() + i)
                if (d.getDay() === 0) return null // skip Sunday
                return (
                  <button
                    key={i}
                    onClick={() => handleDatePick(d)}
                    className={`px-3 py-2 border rounded-sm text-xs transition-colors ${
                      selectedDate && isoDate(selectedDate) === isoDate(d)
                        ? 'border-accent bg-accent text-white'
                        : 'border-border hover:border-accent/50'
                    }`}
                  >
                    <div className="font-medium">{d.toLocaleDateString('da-DK', { weekday: 'short' })}</div>
                    <div>
                      {d.getDate()}/{d.getMonth() + 1}
                    </div>
                  </button>
                )
              }).filter(Boolean)}
            </div>
          </div>
        )}

        {/* Time slots */}
        {selectedDate && (
          <div>
            <label className="block text-xs tracking-[0.08em] uppercase text-ink-subtle mb-2">
              Tidspunkt — {formatDateLong(selectedDate)}
            </label>
            {loadingSlots ? (
              <p className="text-xs text-ink-subtle">Henter ledige tider…</p>
            ) : slots.length === 0 ? (
              <p className="text-xs text-ink-muted">Ingen ledige tider denne dag.</p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {slots.map((slot) => (
                  <button
                    key={slot.slot_starts_at}
                    onClick={() => setSelectedSlot(slot.slot_starts_at)}
                    className={`py-2 border rounded-sm text-sm transition-colors ${
                      selectedSlot === slot.slot_starts_at
                        ? 'border-accent bg-accent text-white'
                        : 'border-border hover:border-accent/50'
                    }`}
                  >
                    {formatTimeShort(new Date(slot.slot_starts_at))}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Customer info */}
        {selectedSlot && (
          <div className="space-y-3 border-t border-border pt-4">
            <div>
              <label className="block text-xs tracking-[0.08em] uppercase text-ink-subtle mb-1">Kundens navn</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full border border-border rounded-sm px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs tracking-[0.08em] uppercase text-ink-subtle mb-1">
                Telefonnummer
              </label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="12 34 56 78"
                inputMode="numeric"
                className="w-full border border-border rounded-sm px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs tracking-[0.08em] uppercase text-ink-subtle mb-1">
                Note (valgfrit)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="f.eks. vil betale med MobilePay"
                className="w-full border border-border rounded-sm px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
            </div>
          </div>
        )}

        {error && (
          <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-sm">
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        {selectedSlot && customerName && customerPhone && (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-3.5 bg-accent text-white text-sm font-medium tracking-[0.08em] uppercase hover:bg-accent-deep transition-colors disabled:opacity-60"
          >
            {submitting ? 'Opretter…' : 'Opret booking'}
          </button>
        )}
      </div>
    </div>
  )
}
