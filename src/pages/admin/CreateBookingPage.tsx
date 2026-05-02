import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useServices } from '../../hooks/useServices'
import { useBarbers } from '../../hooks/useBarbers'
import { formatDKK } from '../../types/database'
import { isoDate, isoWeekday } from '../../lib/danishDates'
import { AssignedBarberRow } from '../../components/admin/booking/AssignedBarberRow'
import { getDisabledDates } from '../../utils/barberAvailability'

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

interface CustomerLookupRow {
  id: string
  full_name: string
  phone_e164: string
}

const SELECT_BTN = 'text-left px-3.5 py-2.5 border rounded-lg text-sm transition-all'
const SELECT_DEFAULT =
  'border-gray-200 bg-white hover:border-[#B08A3E]/40 hover:bg-[#FAFAF8]'
const SELECT_ACTIVE = 'border-[#B08A3E] bg-[#B08A3E]/[0.06] text-ink font-medium'

const MONTH_FULL = [
  'januar', 'februar', 'marts', 'april', 'maj', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'december',
]
const WEEKDAY_HEADERS = ['M', 'T', 'O', 'T', 'F', 'L', 'S']

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
  const [eligibleBarberIds, setEligibleBarberIds] = useState<Set<string> | null>(null)
  const [barberId, setBarberId] = useState<string | null>(null)
  const [barberWorkdays, setBarberWorkdays] = useState<number[] | null>(null)
  const [barberTimeOff, setBarberTimeOff] = useState<{ starts_at: string; ends_at: string }[]>([])
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  // Map<timeIso, barberIds[]> — which barbers are free at each slot time
  const [slotBarberMap, setSlotBarberMap] = useState<Map<string, string[]>>(new Map())
  const [existingBookings, setExistingBookings] = useState<ExistingBooking[]>([])
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [autoAssignedBarber, setAutoAssignedBarber] = useState<{ id: string; name: string } | null>(null)

  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [existingCustomer, setExistingCustomer] = useState<CustomerLookupRow | null>(null)
  const [lookupDone, setLookupDone] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [calViewMonth, setCalViewMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  // Fetch eligible barbers whenever the service changes
  useEffect(() => {
    if (!serviceId) {
      setEligibleBarberIds(null)
      return
    }
    let cancelled = false
    supabase
      .from('barber_services')
      .select('barber_id')
      .eq('service_id', serviceId)
      .then(({ data }) => {
        if (cancelled) return
        const ids = new Set<string>((data ?? []).map((r) => r.barber_id))
        setEligibleBarberIds(ids)
        // If currently selected barber is no longer eligible, reset
        setBarberId((prev) => (prev && !ids.has(prev) ? null : prev))
      })
    return () => {
      cancelled = true
    }
  }, [serviceId])

  // Fetch existing bookings whenever date or barber changes — used for the live schedule
  useEffect(() => {
    if (!selectedDate) return
    const start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate())
    const end = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() + 1)

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

  const handleBarberSelect = async (id: string | null) => {
    setBarberId(id)
    setSelectedSlot(null)
    setSlotBarberMap(new Map())
    setAutoAssignedBarber(null)
    if (!id) {
      setBarberWorkdays(null)
      setBarberTimeOff([])
      return
    }
    // Fetch working days + upcoming time off in parallel
    const [hoursRes, timeOffRes] = await Promise.all([
      supabase.from('barber_hours').select('isoweekday, opens_at').eq('barber_id', id),
      supabase
        .from('time_off')
        .select('starts_at, ends_at, is_all_day')
        .eq('barber_id', id)
        .gte('ends_at', new Date().toISOString()),
    ])
    const workdays = ((hoursRes.data ?? []) as { isoweekday: number; opens_at: string | null }[])
      .filter((r) => r.opens_at)
      .map((r) => r.isoweekday)
    setBarberWorkdays(workdays)
    setBarberTimeOff(
      (timeOffRes.data ?? []) as { starts_at: string; ends_at: string }[],
    )
  }

  const handleDatePick = async (date: Date) => {
    setSelectedDate(date)
    setSelectedSlot(null)
    setAutoAssignedBarber(null)
    if (!serviceId) return

    if (barberId) {
      // Specific barber: single RPC call
      const { data } = await supabase.rpc('get_available_slots', {
        p_barber_id: barberId,
        p_service_id: serviceId,
        p_date: isoDate(date),
      })
      const slotsData = (data as Slot[] | null) ?? []
      setSlotBarberMap(new Map(slotsData.map((s) => [s.slot_starts_at, [barberId]])))
      return
    }

    // "Any barber" mode: query each eligible active barber separately and merge
    const activeBarbers = barbers.filter(
      (b) => b.is_active && (!eligibleBarberIds || eligibleBarberIds.has(b.id))
    )
    const results = await Promise.all(
      activeBarbers.map(async (b) => {
        const { data } = await supabase.rpc('get_available_slots', {
          p_barber_id: b.id,
          p_service_id: serviceId,
          p_date: isoDate(date),
        })
        return { barberId: b.id, slots: (data as Slot[] | null) ?? [] }
      }),
    )

    const map = new Map<string, string[]>()
    results.forEach(({ barberId: bid, slots: bSlots }) => {
      bSlots.forEach((s) => {
        const arr = map.get(s.slot_starts_at) ?? []
        if (!arr.includes(bid)) arr.push(bid)
        map.set(s.slot_starts_at, arr)
      })
    })

    setSlotBarberMap(map)
  }

  // Auto-assign the barber with the fewest bookings on the chosen day.
  // Tiebreak: lowest display_order.
  const autoAssignBarber = async (candidateIds: string[]) => {
    if (!selectedDate || candidateIds.length === 0) return null

    const dayStart = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
    )
    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayEnd.getDate() + 1)

    const { data: rows } = await supabase
      .from('bookings')
      .select('barber_id')
      .in('barber_id', candidateIds)
      .gte('starts_at', dayStart.toISOString())
      .lt('starts_at', dayEnd.toISOString())
      .in('status', ['confirmed', 'pending'])

    const counts: Record<string, number> = {}
    candidateIds.forEach((id) => {
      counts[id] = 0
    })
    ;(rows as { barber_id: string }[] | null)?.forEach((b) => {
      counts[b.barber_id] = (counts[b.barber_id] ?? 0) + 1
    })

    const sorted = barbers
      .filter((b) => candidateIds.includes(b.id))
      .sort((a, b) => {
        const ca = counts[a.id] ?? 0
        const cb = counts[b.id] ?? 0
        if (ca !== cb) return ca - cb
        return a.display_order - b.display_order
      })

    const picked = sorted[0]
    if (!picked) return null
    const assigned = { id: picked.id, name: picked.display_name }
    setAutoAssignedBarber(assigned)
    return assigned
  }

  const handleSlotPick = (slotIso: string, candidates: string[]) => {
    setSelectedSlot(slotIso)
    if (barberId) {
      setAutoAssignedBarber(null)
      return
    }
    if (candidates.length === 0) return
    autoAssignBarber(candidates)
  }

  const handlePhoneLookup = async (phone: string) => {
    const cleaned = phone.replace(/[\s\-+]/g, '')
    if (cleaned.length < 8) return
    const last8 = cleaned.slice(-8)

    const { data } = await supabase
      .from('customers')
      .select('id, full_name, phone_e164')
      .ilike('phone_e164', `%${last8}`)
      .limit(1)

    if (data && data.length > 0) {
      const cust = data[0] as CustomerLookupRow
      setExistingCustomer(cust)
      // Only fill name if currently empty (don't overwrite barber's typing)
      setCustomerName((prev) => prev || cust.full_name)
    } else {
      setExistingCustomer(null)
    }
    setLookupDone(true)
  }

  const handleSubmit = async () => {
    if (!serviceId || !selectedSlot || !customerName.trim() || !customerPhone.trim()) return
    setSubmitting(true)
    setError(null)

    const resolvedBarberId = barberId || autoAssignedBarber?.id

    if (!resolvedBarberId) {
      setSubmitting(false)
      setError('Ingen frisør tildelt — prøv igen.')
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

  // Calendar grid for the visible month
  const calYear = calViewMonth.getFullYear()
  const calMonth = calViewMonth.getMonth()
  const calFirstOfMonth = new Date(calYear, calMonth, 1)
  const calStartOffset = isoWeekday(calFirstOfMonth) - 1
  const calStart = new Date(calYear, calMonth, 1 - calStartOffset)
  const calDays: Date[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(calStart)
    d.setDate(calStart.getDate() + i)
    calDays.push(d)
  }

  // Build a Set of disabled date strings (YYYY-MM-DD) from time_off ranges.
  const disabledDates = useMemo(() => getDisabledDates(barberTimeOff), [barberTimeOff])

  const isDayDisabled = (d: Date) => {
    if (d < today) return true
    if (d.getMonth() !== calMonth) return true
    const wd = isoWeekday(d)
    if (wd === 7) return true // Sunday
    if (barberWorkdays && !barberWorkdays.includes(wd)) return true
    if (disabledDates.has(isoDate(d))) return true
    return false
  }

  const goPrevMonth = () => {
    const prev = new Date(calViewMonth)
    prev.setMonth(prev.getMonth() - 1)
    if (prev >= new Date(today.getFullYear(), today.getMonth(), 1)) {
      setCalViewMonth(prev)
    }
  }
  const goNextMonth = () => {
    const next = new Date(calViewMonth)
    next.setMonth(next.getMonth() + 1)
    setCalViewMonth(next)
  }
  const canGoBack = calViewMonth > new Date(today.getFullYear(), today.getMonth(), 1)

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
        return slotStart >= bStart && slotStart < bEnd && (!barberId || b.barber_id === barberId)
      }) ?? null
    )
  }

  // Map "HH:mm" local time → raw RPC slot_starts_at string (the same string used
  // in slotBarberMap keys and in selectedSlot, so we never mix string formats).
  const slotsByLocalTime = useMemo(() => {
    const m = new Map<string, string>()
    for (const iso of slotBarberMap.keys()) {
      const d = new Date(iso)
      const hh = String(d.getHours()).padStart(2, '0')
      const mm = String(d.getMinutes()).padStart(2, '0')
      m.set(`${hh}:${mm}`, iso)
    }
    return m
  }, [slotBarberMap])

  // Times shown in the right-hand grid = union of RPC-returned available slots
  // and 30-min slot positions occupied by existing bookings. Both sources are
  // guaranteed to fall within barber working hours (the RPC enforces it for
  // available slots; bookings are only created within hours via the same RPC).
  // Any time outside working hours (e.g. after Saturday's 14:00 close) is
  // therefore absent from both sets and is correctly filtered out.
  const displayTimes = useMemo(() => {
    const set = new Set<string>()
    for (const time of slotsByLocalTime.keys()) set.add(time)
    if (selectedDate) {
      for (const bk of existingBookings) {
        if (barberId && bk.barber_id !== barberId) continue
        const start = new Date(bk.starts_at)
        if (
          start.getFullYear() !== selectedDate.getFullYear() ||
          start.getMonth() !== selectedDate.getMonth() ||
          start.getDate() !== selectedDate.getDate()
        ) {
          continue
        }
        const startMin = start.getHours() * 60 + start.getMinutes()
        const flooredStart = Math.floor(startMin / 30) * 30
        const endTotalMin = startMin + bk.duration_minutes
        for (let cursor = flooredStart; cursor < endTotalMin && cursor < 24 * 60; cursor += 30) {
          const hh = String(Math.floor(cursor / 60)).padStart(2, '0')
          const mm = String(cursor % 60).padStart(2, '0')
          set.add(`${hh}:${mm}`)
        }
      }
    }
    return Array.from(set).sort()
  }, [slotsByLocalTime, existingBookings, barberId, selectedDate])

  const cleanedPhoneLength = customerPhone.replace(/\s/g, '').length
  const canSubmit =
    serviceId && selectedSlot && customerName.trim() && customerPhone.trim() && !submitting

  return (
    <div className="md:h-full md:flex md:flex-col md:min-h-0 flex-1">
      <div className="flex flex-col md:flex-row gap-4 md:min-h-0 flex-1 md:h-full">
        {/* LEFT: booking form */}
        <div className="w-full md:max-w-md md:flex-shrink-0 md:overflow-y-auto md:pr-1 space-y-4">
          <h1 className="text-[22px] font-semibold text-ink">Opret telefonbooking</h1>

          {/* Customer info — always visible */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <SectionLabel>Kundeoplysninger</SectionLabel>
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] tracking-[0.08em] uppercase text-[#8A8A8A] mb-1.5">
                  Telefonnummer
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => {
                    setCustomerPhone(e.target.value)
                    setLookupDone(false)
                    setExistingCustomer(null)
                  }}
                  onBlur={(e) => handlePhoneLookup(e.target.value)}
                  placeholder="12 34 56 78"
                  inputMode="numeric"
                  className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-[#B08A3E] focus:ring-2 focus:ring-[#B08A3E]/15 transition-all"
                />
                {existingCustomer && (
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                    <span className="text-xs text-green-700">
                      Eksisterende kunde — {existingCustomer.full_name}
                    </span>
                  </div>
                )}
                {lookupDone && !existingCustomer && cleanedPhoneLength >= 8 && (
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="text-xs text-gray-400">Ny kunde</span>
                  </div>
                )}
              </div>
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
                  Type af klipning <span className="text-[#8A8A8A] font-normal normal-case">(valgfrit)</span>
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder='F.eks. "Low fade, lineup, lidt af toppen"'
                  className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-[#B08A3E] focus:ring-2 focus:ring-[#B08A3E]/15 transition-all"
                />
              </div>
            </div>
          </div>

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
                      setSlotBarberMap(new Map())
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
            <div>
              <SectionLabel>Frisør</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleBarberSelect(null)}
                  className={`${SELECT_BTN} ${barberId === null ? SELECT_ACTIVE : SELECT_DEFAULT}`}
                >
                  Første ledige
                </button>
                {barbers
                  .filter((b) => !eligibleBarberIds || eligibleBarberIds.has(b.id))
                  .map((b) => (
                    <button
                      key={b.id}
                      onClick={() => handleBarberSelect(b.id)}
                      className={`${SELECT_BTN} ${barberId === b.id ? SELECT_ACTIVE : SELECT_DEFAULT}`}
                    >
                      {b.display_name}
                    </button>
                  ))}
                {serviceId && eligibleBarberIds && eligibleBarberIds.size === 0 && (
                  <p className="col-span-2 text-xs text-[#9B2C2C] mt-1">
                    Ingen frisører kan udføre denne ydelse.
                  </p>
                )}
              </div>
            </div>

            {/* Date — full month calendar (always visible) */}
            <div>
              <SectionLabel>Dato</SectionLabel>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Month header */}
                  <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50">
                    <button
                      type="button"
                      onClick={goPrevMonth}
                      disabled={!canGoBack}
                      className="px-2 py-1 text-xs text-gray-500 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      ←
                    </button>
                    <span className="text-sm text-gray-900 capitalize">
                      {MONTH_FULL[calMonth]} {calYear}
                    </span>
                    <button
                      type="button"
                      onClick={goNextMonth}
                      className="px-2 py-1 text-xs text-gray-500 hover:text-gray-900 transition-colors"
                    >
                      →
                    </button>
                  </div>

                  {/* Weekday headers */}
                  <div className="grid grid-cols-7 border-b border-gray-100">
                    {WEEKDAY_HEADERS.map((d, i) => (
                      <div
                        key={i}
                        className="text-center py-1.5 text-[10px] font-semibold tracking-[0.08em] uppercase text-gray-400"
                      >
                        {d}
                      </div>
                    ))}
                  </div>

                  {/* Day grid */}
                  <div className="grid grid-cols-7">
                    {calDays.map((d, i) => {
                      const disabled = isDayDisabled(d)
                      const isSelected =
                        selectedDate && isoDate(d) === isoDate(selectedDate)
                      const isOutside = d.getMonth() !== calMonth
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => !disabled && handleDatePick(d)}
                          disabled={disabled}
                          className={`aspect-square text-xs transition-colors ${
                            isSelected
                              ? 'bg-[#1A1A1A] text-white font-medium'
                              : disabled
                                ? 'text-gray-300 cursor-not-allowed'
                                : isOutside
                                  ? 'text-gray-300 hover:bg-gray-50'
                                  : 'text-gray-700 hover:bg-[#B08A3E]/10'
                          }`}
                        >
                          {d.getDate()}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

            {/* Assigned barber row (any-barber mode only) */}
            {!barberId && selectedSlot && autoAssignedBarber && (
              <AssignedBarberRow
                assignedBarber={autoAssignedBarber}
                availableBarbers={(slotBarberMap.get(selectedSlot) ?? [])
                  .map((id) => {
                    const b = barbers.find((x) => x.id === id)
                    return b ? { id: b.id, name: b.display_name } : null
                  })
                  .filter((b): b is { id: string; name: string } => b !== null)}
                onSwap={(barberId) => {
                  const b = barbers.find((x) => x.id === barberId)
                  if (b) setAutoAssignedBarber({ id: b.id, name: b.display_name })
                }}
              />
            )}

            {error && (
              <div className="px-3.5 py-2.5 bg-[#FCE8E8] border border-[#FCE8E8] rounded-lg">
                <p className="text-[12px] text-[#9B2C2C]">{error}</p>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full py-3.5 bg-[#B08A3E] text-white text-sm font-medium tracking-[0.04em] rounded-lg hover:bg-[#8C6A28] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? 'Opretter…' : 'Opret booking'}
            </button>
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
              ) : !serviceId ? (
                <div className="flex items-center justify-center h-full p-8">
                  <p className="text-sm text-gray-400">Vælg en ydelse for at se ledige tider</p>
                </div>
              ) : displayTimes.length === 0 ? (
                <div className="flex items-center justify-center h-full p-8">
                  <p className="text-sm text-gray-400">Ingen ledige tider på denne dato</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {displayTimes.map((time) => {
                    const booked = isSlotBooked(time)
                    // Compare against the same raw iso we render with — never
                    // re-stringify selectedSlot because format may differ.
                    const isSelected =
                      selectedSlot && selectedSlot === slotsByLocalTime.get(time)

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

                    const slotIso = slotsByLocalTime.get(time)
                    const isAvailable = !!slotIso
                    return (
                      <button
                        key={time}
                        disabled={!isAvailable}
                        onClick={() => {
                          if (!slotIso) return
                          const candidates = slotBarberMap.get(slotIso) ?? []
                          handleSlotPick(slotIso, candidates)
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left ${
                          isSelected
                            ? 'bg-[#1A1A1A] text-white'
                            : isAvailable
                              ? 'hover:bg-gray-50'
                              : 'opacity-50 cursor-not-allowed'
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
