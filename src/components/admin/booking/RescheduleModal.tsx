import { useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { isoDate, isoWeekday } from '../../../lib/danishDates'

interface RescheduleModalProps {
  booking: {
    id: string
    barber_id: string
    service_id: string
    starts_at: string
    ends_at: string
    customer_name: string
    service_name: string
    barber_name: string
  }
  onRescheduled: () => void
  onClose: () => void
}

interface Slot {
  slot_starts_at: string
}

const MONTH_FULL = [
  'januar', 'februar', 'marts', 'april', 'maj', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'december',
]
const WEEKDAY_HEADERS = ['M', 'T', 'O', 'T', 'F', 'L', 'S']
const DAY_SHORT_PERIOD = ['søn.', 'man.', 'tir.', 'ons.', 'tor.', 'fre.', 'lør.']
const MONTH_SHORT_PERIOD = ['jan.', 'feb.', 'mar.', 'apr.', 'maj', 'jun.', 'jul.', 'aug.', 'sep.', 'okt.', 'nov.', 'dec.']

function formatLongDanish(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${DAY_SHORT_PERIOD[d.getDay()]} ${d.getDate()}. ${MONTH_SHORT_PERIOD[d.getMonth()]} kl. ${hh}.${mm}`
}

export function RescheduleModal({ booking, onRescheduled, onClose }: RescheduleModalProps) {
  const today = useMemo(() => {
    const t = new Date()
    t.setHours(0, 0, 0, 0)
    return t
  }, [])

  const [calViewMonth, setCalViewMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [slots, setSlots] = useState<Slot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selectedSlotIso, setSelectedSlotIso] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentStartsAt = useMemo(() => new Date(booking.starts_at), [booking.starts_at])
  const durationMs = useMemo(
    () => new Date(booking.ends_at).getTime() - new Date(booking.starts_at).getTime(),
    [booking.starts_at, booking.ends_at],
  )

  const handleDatePick = (d: Date) => {
    setSelectedDate(d)
    setSelectedSlotIso(null)
    setSlots([])
    setLoadingSlots(true)
    supabase
      .rpc('get_available_slots', {
        p_barber_id: booking.barber_id,
        p_service_id: booking.service_id,
        p_date: isoDate(d),
      })
      .then(({ data }) => {
        const list = (data as Slot[] | null) ?? []
        // Exclude the booking's current slot — it would conflict with itself.
        const filtered = list.filter(
          (s) => new Date(s.slot_starts_at).getTime() !== currentStartsAt.getTime(),
        )
        setSlots(filtered)
        setLoadingSlots(false)
      })
  }

  const calYear = calViewMonth.getFullYear()
  const calMonth = calViewMonth.getMonth()
  const firstOfMonth = new Date(calYear, calMonth, 1)
  const startOffset = isoWeekday(firstOfMonth) - 1
  const calStart = new Date(calYear, calMonth, 1 - startOffset)
  const days: Date[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(calStart)
    d.setDate(calStart.getDate() + i)
    days.push(d)
  }

  const isDayDisabled = (d: Date) => {
    if (d < today) return true
    if (d.getMonth() !== calMonth) return true
    if (isoWeekday(d) === 7) return true // Sunday
    return false
  }

  const goPrev = () => {
    const prev = new Date(calViewMonth)
    prev.setMonth(prev.getMonth() - 1)
    if (prev >= new Date(today.getFullYear(), today.getMonth(), 1)) setCalViewMonth(prev)
  }
  const goNext = () => {
    const next = new Date(calViewMonth)
    next.setMonth(next.getMonth() + 1)
    setCalViewMonth(next)
  }
  const canGoBack = calViewMonth > new Date(today.getFullYear(), today.getMonth(), 1)

  const handleConfirm = async () => {
    if (!selectedSlotIso) return
    setSubmitting(true)
    setError(null)
    const newStarts = new Date(selectedSlotIso)
    const newEnds = new Date(newStarts.getTime() + durationMs)
    const { error: dbErr } = await supabase
      .from('bookings')
      .update({
        starts_at: newStarts.toISOString(),
        ends_at: newEnds.toISOString(),
      })
      .eq('id', booking.id)
    setSubmitting(false)
    if (dbErr) {
      setError('Kunne ikke flytte booking — prøv igen.')
      return
    }
    onRescheduled()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-lg border border-gray-200 w-full max-w-lg overflow-hidden shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 flex-shrink-0">
          <h3 className="text-sm font-medium text-gray-900">
            Flyt booking — {booking.customer_name}
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

        <div className="px-5 py-3 border-b border-gray-200 flex-shrink-0 text-xs">
          <p className="text-gray-500">
            {booking.service_name} hos {booking.barber_name}
          </p>
          <p className="text-gray-400 mt-0.5 line-through">{formatLongDanish(currentStartsAt)}</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Calendar */}
          <div className="p-4">
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50">
                <button
                  type="button"
                  onClick={goPrev}
                  disabled={!canGoBack}
                  className="px-2 py-1 text-xs text-gray-500 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ←
                </button>
                <span className="text-sm text-gray-900 capitalize">
                  {MONTH_FULL[calMonth]} {calYear}
                </span>
                <button
                  type="button"
                  onClick={goNext}
                  className="px-2 py-1 text-xs text-gray-500 hover:text-gray-900"
                >
                  →
                </button>
              </div>
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
              <div className="grid grid-cols-7">
                {days.map((d, i) => {
                  const disabled = isDayDisabled(d)
                  const isSelected = selectedDate && isoDate(d) === isoDate(selectedDate)
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

          {/* Slot list */}
          {selectedDate && (
            <div className="px-4 pb-4">
              <p className="text-[11px] tracking-[0.08em] uppercase text-gray-400 font-medium mb-2">
                Ledige tider
              </p>
              {loadingSlots ? (
                <p className="text-xs text-gray-400">Henter ledige tider…</p>
              ) : slots.length === 0 ? (
                <p className="text-xs text-gray-500">Ingen ledige tider denne dag.</p>
              ) : (
                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {slots.map((slot) => {
                    const d = new Date(slot.slot_starts_at)
                    const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
                    const isSelected = selectedSlotIso === slot.slot_starts_at
                    return (
                      <button
                        key={slot.slot_starts_at}
                        onClick={() => setSelectedSlotIso(slot.slot_starts_at)}
                        className={`w-full flex items-center gap-3 px-4 py-2 transition-colors text-left ${
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
                          className={`text-xs ${isSelected ? 'text-white font-medium' : 'text-gray-300'}`}
                        >
                          {isSelected ? '✓ Valgt' : '+ Ledig'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-end gap-2 flex-shrink-0">
          {error && <p className="text-xs text-red-500 mr-auto">{error}</p>}
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 text-gray-500 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            Annuller
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedSlotIso || submitting}
            className="px-4 py-2 bg-[#B08A3E] hover:bg-[#8C6A28] text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {submitting ? 'Flytter…' : 'Bekræft ny tid'}
          </button>
        </div>
      </div>
    </div>
  )
}
