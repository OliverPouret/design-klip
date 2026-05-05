import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useServices } from '../../hooks/useServices'
import { useBarbers } from '../../hooks/useBarbers'
import {
  formatMonthYear,
  formatDateLong,
  formatTimeShort,
  isoDate,
  isoWeekday,
} from '../../lib/danishDates'
import type { BookingState } from '../../pages/BookingPage'

interface Slot {
  slot_starts_at: string
  available_barber_ids: string[]
}

const WEEKDAY_HEADERS = ['M', 'T', 'O', 'T', 'F', 'L', 'S']

export function DateTimeStep({
  state,
  onSelect,
}: {
  state: BookingState
  onSelect: (startsAt: string, resolvedBarberId: string) => void
}) {
  const { services } = useServices()
  const { barbers } = useBarbers()
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [slots, setSlots] = useState<Slot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)

  const service = services.find((s) => s.slug === state.serviceSlug)
  const barber = state.anyBarber
    ? null
    : barbers.find((b) => b.slug === state.barberSlug)

  const [barberWorkdays, setBarberWorkdays] = useState<number[] | null>(null)
  useEffect(() => {
    if (state.anyBarber || !barber) return
    supabase
      .from('barber_hours')
      .select('isoweekday, opens_at')
      .eq('barber_id', barber.id)
      .then(({ data }) => {
        if (!data) return
        const days = data
          .filter((row: { opens_at: string | null }) => row.opens_at !== null)
          .map((row: { isoweekday: number }) => row.isoweekday)
        setBarberWorkdays(days)
      })
  }, [barber, state.anyBarber])

  useEffect(() => {
    if (!selectedDate || !service) return

    const barberId = state.anyBarber ? null : barber?.id ?? null
    supabase
      .rpc('get_available_slots', {
        p_barber_id: barberId,
        p_service_id: service.id,
        p_date: isoDate(selectedDate),
      })
      .then(({ data }) => {
        setSlots(data ?? [])
        setLoadingSlots(false)
      })
  }, [selectedDate, service, barber, state.anyBarber])

  const handleDatePick = (d: Date) => {
    setSelectedDate(d)
    setSlots([])
    setLoadingSlots(true)
  }

  if (!service) {
    return <p className="text-center text-sm text-ink-subtle py-12">Henter…</p>
  }

  const year = viewMonth.getFullYear()
  const month = viewMonth.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const maxDate = new Date(today)
  maxDate.setDate(today.getDate() + 365)

  const startOffset = isoWeekday(firstOfMonth) - 1
  const calendarStart = new Date(year, month, 1 - startOffset)

  const days: Date[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(calendarStart)
    d.setDate(calendarStart.getDate() + i)
    days.push(d)
  }

  const isDayDisabled = (d: Date): boolean => {
    if (d < today) return true
    if (d > maxDate) return true
    if (d.getMonth() !== month) return true
    const wd = isoWeekday(d)
    if (wd === 7) return true
    if (barberWorkdays && !barberWorkdays.includes(wd)) return true
    return false
  }

  const goToPrevMonth = () => {
    const prev = new Date(viewMonth)
    prev.setMonth(prev.getMonth() - 1)
    if (prev >= new Date(today.getFullYear(), today.getMonth(), 1)) {
      setViewMonth(prev)
    }
  }
  const goToNextMonth = () => {
    const next = new Date(viewMonth)
    next.setMonth(next.getMonth() + 1)
    setViewMonth(next)
  }

  const canGoBack = viewMonth > new Date(today.getFullYear(), today.getMonth(), 1)

  const handleSlotPick = async (slot: Slot) => {
    let resolvedBarberId: string | undefined | null
    if (state.anyBarber) {
      // Server picks the least-loaded eligible barber from the slot's
      // candidate set (orders by today's load, then all-time, then
      // display_order, then alphabetical). Falls back to the first
      // candidate if the RPC fails so the booking flow never dead-ends.
      const { data, error } = await supabase.rpc('pick_least_loaded_barber', {
        p_candidate_ids: slot.available_barber_ids,
      })
      if (error || !data) {
        resolvedBarberId = slot.available_barber_ids[0]
      } else {
        resolvedBarberId = data as string
      }
    } else {
      resolvedBarberId = barber?.id
    }
    if (!resolvedBarberId) return
    onSelect(slot.slot_starts_at, resolvedBarberId)
  }

  return (
    <div>
      <h2 className="font-serif text-display-md text-ink text-center mb-2">
        Vælg tidspunkt
      </h2>
      <p className="text-center text-sm text-ink-muted mb-6">
        {service.name_da} ({service.duration_minutes} min)
        {!state.anyBarber && barber && ` hos ${barber.display_name}`}
      </p>

      <div className="border border-border rounded-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <button
            onClick={goToPrevMonth}
            disabled={!canGoBack}
            className="p-2 text-ink-muted hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Forrige måned"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span className="font-serif text-base text-ink">
            {formatMonthYear(viewMonth)}
          </span>
          <button
            onClick={goToNextMonth}
            className="p-2 text-ink-muted hover:text-ink transition-colors"
            aria-label="Næste måned"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-7 border-b border-border">
          {WEEKDAY_HEADERS.map((d, i) => (
            <div key={i} className="text-center py-2 text-[0.625rem] tracking-[0.08em] uppercase text-ink-subtle">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map((d, i) => {
            const disabled = isDayDisabled(d)
            const isSelected =
              selectedDate && isoDate(d) === isoDate(selectedDate)
            const isOutside = d.getMonth() !== month
            return (
              <button
                key={i}
                onClick={() => !disabled && handleDatePick(d)}
                disabled={disabled}
                className={`aspect-square text-sm transition-colors ${
                  isSelected
                    ? 'bg-accent text-white font-medium'
                    : disabled
                    ? 'text-ink-subtle/40 cursor-not-allowed'
                    : isOutside
                    ? 'text-ink-subtle hover:bg-surface'
                    : 'text-ink hover:bg-accent/10'
                }`}
              >
                {d.getDate()}
              </button>
            )
          })}
        </div>
      </div>

      {selectedDate && (
        <div className="mt-8">
          <p className="text-sm font-medium text-ink mb-3">
            {formatDateLong(selectedDate)}
          </p>

          {loadingSlots ? (
            <p className="text-sm text-ink-subtle">Henter ledige tider…</p>
          ) : slots.length === 0 ? (
            <p className="text-sm text-ink-muted">
              Ingen ledige tider denne dag. Prøv en anden dato.
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {slots.map((slot) => (
                <button
                  key={slot.slot_starts_at}
                  onClick={() => handleSlotPick(slot)}
                  className="py-3 border border-border text-sm text-ink hover:border-accent hover:bg-accent/5 transition-colors rounded-sm"
                >
                  {formatTimeShort(new Date(slot.slot_starts_at))}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
