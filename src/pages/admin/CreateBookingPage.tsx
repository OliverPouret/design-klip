import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useServices } from '../../hooks/useServices'
import { useBarbers } from '../../hooks/useBarbers'
import { formatDKK } from '../../types/database'
import { formatDateLong, formatTimeShort, isoDate } from '../../lib/danishDates'
import { Card } from '../../components/admin/Card'

interface Slot {
  slot_starts_at: string
  available_barber_ids: string[]
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b border-gray-100 pb-2 mb-3">
      <p className="text-[11px] tracking-[0.08em] uppercase text-[#8A8A8A] font-medium">{children}</p>
    </div>
  )
}

const SELECT_BTN =
  'text-left px-3.5 py-2.5 border rounded-lg text-sm transition-all'
const SELECT_DEFAULT =
  'border-gray-200 bg-white hover:border-[#B08A3E]/40 hover:bg-[#FAFAF8]'
const SELECT_ACTIVE =
  'border-[#B08A3E] bg-[#B08A3E]/[0.06] text-ink font-medium'

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
    <div className="max-w-2xl md:h-full md:flex md:flex-col md:min-h-0 md:overflow-y-auto md:pr-1 space-y-4">
      <h1 className="font-serif text-[22px] text-ink flex-shrink-0">Opret telefonbooking</h1>

      <Card>
        <div className="space-y-6">
          {/* Service */}
          <div>
            <SectionLabel>Ydelse</SectionLabel>
            <div className="grid grid-cols-1 gap-2">
              {services.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setServiceId(s.id)
                    setSelectedSlot(null)
                    setSlots([])
                  }}
                  className={`${SELECT_BTN} ${serviceId === s.id ? SELECT_ACTIVE : SELECT_DEFAULT}`}
                >
                  <div className="flex items-center justify-between">
                    <span>{s.name_da}</span>
                    <span className="text-[12px] text-[#5F5E5A]">
                      {formatDKK(s.price_ore)} · {s.duration_minutes} min
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Barber */}
          {serviceId && (
            <div>
              <SectionLabel>Frisør</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setBarberId(null)
                    setSelectedSlot(null)
                    setSlots([])
                  }}
                  className={`${SELECT_BTN} ${barberId === null ? SELECT_ACTIVE : SELECT_DEFAULT}`}
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
                    className={`${SELECT_BTN} ${barberId === b.id ? SELECT_ACTIVE : SELECT_DEFAULT}`}
                  >
                    {b.display_name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Date */}
          {serviceId && (
            <div>
              <SectionLabel>Dato</SectionLabel>
              <div className="flex gap-2 flex-wrap">
                {Array.from({ length: 14 }, (_, i) => {
                  const d = new Date(today)
                  d.setDate(today.getDate() + i)
                  if (d.getDay() === 0) return null
                  const isActive = selectedDate && isoDate(selectedDate) === isoDate(d)
                  return (
                    <button
                      key={i}
                      onClick={() => handleDatePick(d)}
                      className={`px-3 py-2 border rounded-lg text-[12px] transition-all ${
                        isActive
                          ? 'border-[#B08A3E] bg-[#B08A3E] text-white'
                          : 'border-gray-200 bg-white hover:border-[#B08A3E]/40 hover:bg-[#FAFAF8]'
                      }`}
                    >
                      <div className="font-medium">{d.toLocaleDateString('da-DK', { weekday: 'short' })}</div>
                      <div className={isActive ? 'text-white/85' : 'text-[#8A8A8A]'}>
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
              <SectionLabel>Tidspunkt — {formatDateLong(selectedDate)}</SectionLabel>
              {loadingSlots ? (
                <p className="text-[12px] text-[#8A8A8A]">Henter ledige tider…</p>
              ) : slots.length === 0 ? (
                <p className="text-[12px] text-[#5F5E5A]">Ingen ledige tider denne dag.</p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {slots.map((slot) => {
                    const isActive = selectedSlot === slot.slot_starts_at
                    return (
                      <button
                        key={slot.slot_starts_at}
                        onClick={() => setSelectedSlot(slot.slot_starts_at)}
                        className={`py-2 border rounded-lg text-sm transition-all ${
                          isActive
                            ? 'border-[#B08A3E] bg-[#B08A3E] text-white'
                            : 'border-gray-200 bg-white hover:border-[#B08A3E]/40 hover:bg-[#FAFAF8]'
                        }`}
                      >
                        {formatTimeShort(new Date(slot.slot_starts_at))}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Customer info */}
          {selectedSlot && (
            <div>
              <SectionLabel>Kundeoplysninger</SectionLabel>
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] tracking-[0.08em] uppercase text-[#8A8A8A] mb-1.5">
                    Navn
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-[#B08A3E] focus:ring-2 focus:ring-[#B08A3E]/15 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[11px] tracking-[0.08em] uppercase text-[#8A8A8A] mb-1.5">
                    Telefonnummer
                  </label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="12 34 56 78"
                    inputMode="numeric"
                    className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-[#B08A3E] focus:ring-2 focus:ring-[#B08A3E]/15 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[11px] tracking-[0.08em] uppercase text-[#8A8A8A] mb-1.5">
                    Note (valgfrit)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="f.eks. vil betale med MobilePay"
                    className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-[#B08A3E] focus:ring-2 focus:ring-[#B08A3E]/15 transition-all"
                  />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="px-3.5 py-2.5 bg-[#FCE8E8] border border-[#FCE8E8] rounded-lg">
              <p className="text-[12px] text-[#9B2C2C]">{error}</p>
            </div>
          )}

          {selectedSlot && customerName && customerPhone && (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full py-3.5 bg-[#B08A3E] text-white text-sm font-medium tracking-[0.04em] rounded-lg hover:bg-[#8C6A28] transition-colors disabled:opacity-60"
            >
              {submitting ? 'Opretter…' : 'Opret booking'}
            </button>
          )}
        </div>
      </Card>
    </div>
  )
}
