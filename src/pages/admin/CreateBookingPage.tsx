import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useServices } from '../../hooks/useServices'
import { useBarbers } from '../../hooks/useBarbers'
import { formatDKK } from '../../types/database'
import { formatTimeShort, isoDate } from '../../lib/danishDates'

interface Slot {
  slot_starts_at: string
  available_barber_ids: string[]
}

interface ExistingBooking {
  starts_at: string
  duration_minutes: number
  barber_id: string
  customer: { full_name: string }
  service: { name_da: string }
}

const SELECT_BTN = 'text-left px-3.5 py-2.5 border rounded-lg text-sm transition-all'
const SELECT_DEFAULT =
  'border-gray-200 bg-white hover:border-[#B08A3E]/40 hover:bg-[#FAFAF8]'
const SELECT_ACTIVE = 'border-[#B08A3E] bg-[#B08A3E]/[0.06] text-ink font-medium'

const TIME_SLOTS = Array.from({ length: 17 }, (_, i) => {
  const totalMins = 9 * 60 + i * 30
  const h = Math.floor(totalMins / 60).toString().padStart(2, '0')
  const m = (totalMins % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}) // 09:00–17:00

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b border-gray-100 pb-2 mb-3">
      <p className="text-[11px] tracking-[0.08em] uppercase text-[#8A8A8A] font-medium">{children}</p>
    </div>
  )
}

export function CreateBookingPage() {
  const navigate = useNavigate()
  const { services } = useServices()
  const { barbers } = useBarbers()

  const [serviceId, setServiceId] = useState<string | null>(null)
  const [barberId, setBarberId] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [slots, setSlots] = useState<Slot[]>([])
  const [existingBookings, setExistingBookings] = useState<ExistingBooking[]>([])
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch existing bookings whenever date or barber changes — used for the live schedule
  useEffect(() => {
    if (!selectedDate) return
    const start = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
    )
    const end = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate() + 1,
    )

    supabase
      .from('bookings')
      .select(
        'starts_at, duration_minutes, barber_id, customer:customers!inner(full_name), service:services!inner(name_da)',
      )
      .gte('starts_at', start.toISOString())
      .lt('starts_at', end.toISOString())
      .in('status', ['confirmed', 'pending'])
      .then(({ data }) => {
        setExistingBookings((data ?? []) as unknown as ExistingBooking[])
      })
  }, [selectedDate, barberId])

  const handleDatePick = async (date: Date) => {
    setSelectedDate(date)
    setSelectedSlot(null)
    if (!serviceId) return
    const { data } = await supabase.rpc('get_available_slots', {
      p_barber_id: barberId || null,
      p_service_id: serviceId,
      p_date: isoDate(date),
    })
    setSlots((data as Slot[] | null) ?? [])
  }

  const handleSubmit = async () => {
    if (!serviceId || !selectedSlot || !customerName.trim() || !customerPhone.trim()) return
    setSubmitting(true)
    setError(null)

    const resolvedBarberId =
      barberId || slots.find((s) => s.slot_starts_at === selectedSlot)?.available_barber_ids[0]

    if (!resolvedBarberId) {
      setSubmitting(false)
      setError('Ingen frisør er ledig på det valgte tidspunkt.')
      return
    }

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

    const bookingId = Array.isArray(data)
      ? data[0]?.booking_id
      : (data as { booking_id?: string } | null)?.booking_id
    if (bookingId) {
      await supabase.from('bookings').update({ source: 'phone' }).eq('id', bookingId)
    }

    navigate('/admin/i-dag')
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Lookup helpers for the live schedule
  const isSlotBooked = (timeStr: string): ExistingBooking | null => {
    if (!selectedDate) return null
    const [h, m] = timeStr.split(':').map(Number)
    const slotStart = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      h,
      m,
    )
    return (
      existingBookings.find((b) => {
        const bStart = new Date(b.starts_at)
        const bEnd = new Date(bStart.getTime() + b.duration_minutes * 60000)
        return (
          slotStart >= bStart && slotStart < bEnd && (!barberId || b.barber_id === barberId)
        )
      }) ?? null
    )
  }

  return (
    <div className="md:h-full md:flex md:flex-col md:min-h-0 flex-1">
      <div className="flex flex-col md:flex-row gap-4 md:min-h-0 flex-1 md:h-full">
        {/* LEFT: booking form */}
        <div className="w-full md:max-w-md md:flex-shrink-0 md:overflow-y-auto md:pr-1 space-y-4">
          <h1 className="font-serif text-[22px] text-ink">Opret telefonbooking</h1>

          <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-6">
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
        </div>

        {/* RIGHT: live schedule */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="bg-white rounded-lg border border-gray-200 flex flex-col h-full">
            <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-sm font-medium text-gray-900 capitalize">
                {selectedDate
                  ? selectedDate.toLocaleDateString('da-DK', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })
                  : 'Vælg dato for at se ledige tider'}
              </h3>
            </div>

            <div className="flex-1 md:overflow-y-auto">
              {!selectedDate ? (
                <div className="flex items-center justify-center h-full p-8">
                  <p className="text-sm text-gray-400">Ingen dato valgt</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {TIME_SLOTS.map((time) => {
                    const booked = isSlotBooked(time)
                    const isSelected =
                      selectedSlot && formatTimeShort(new Date(selectedSlot)) === time

                    if (booked) {
                      return (
                        <div
                          key={time}
                          className="flex items-center gap-3 px-4 py-2.5 bg-[#B08A3E]/5"
                        >
                          <span className="text-xs text-gray-400 w-12 flex-shrink-0">{time}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-[#8C6A28] truncate">
                              {booked.customer.full_name}
                            </p>
                            <p className="text-[10px] text-gray-400 truncate">
                              {booked.service.name_da}
                            </p>
                          </div>
                        </div>
                      )
                    }

                    return (
                      <button
                        key={time}
                        onClick={() => {
                          if (!selectedDate) return
                          const [h, m] = time.split(':').map(Number)
                          const slotDate = new Date(
                            selectedDate.getFullYear(),
                            selectedDate.getMonth(),
                            selectedDate.getDate(),
                            h,
                            m,
                          )
                          setSelectedSlot(slotDate.toISOString())
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left ${
                          isSelected ? 'bg-[#1A1A1A] text-white' : 'hover:bg-gray-50'
                        }`}
                      >
                        <span
                          className={`text-xs w-12 flex-shrink-0 ${
                            isSelected ? 'text-white' : 'text-gray-400'
                          }`}
                        >
                          {time}
                        </span>
                        <span
                          className={`text-xs ${
                            isSelected ? 'text-white font-medium' : 'text-gray-300'
                          }`}
                        >
                          {isSelected ? '✓ Valgt' : '+ Ledig'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
