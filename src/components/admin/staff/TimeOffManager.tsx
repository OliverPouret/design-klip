import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

interface TimeOffManagerProps {
  barberId: string
}

interface TimeOffRow {
  id: string
  starts_at: string
  ends_at: string
  reason: string | null
}

const DAY_SHORT = ['søn.', 'man.', 'tir.', 'ons.', 'tor.', 'fre.', 'lør.']
const MONTH_SHORT = ['jan.', 'feb.', 'mar.', 'apr.', 'maj', 'jun.', 'jul.', 'aug.', 'sep.', 'okt.', 'nov.', 'dec.']

function todayLocalIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDanishDate(starts_at: string): string {
  const d = new Date(starts_at)
  return `${DAY_SHORT[d.getDay()]} ${d.getDate()}. ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`
}

export function TimeOffManager({ barberId }: TimeOffManagerProps) {
  const [rows, setRows] = useState<TimeOffRow[]>([])
  const [loading, setLoading] = useState(true)
  const [newDate, setNewDate] = useState('')
  const [newReason, setNewReason] = useState('')
  const [adding, setAdding] = useState(false)
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const today = todayLocalIso()

  useEffect(() => {
    const fetch = async () => {
      // Use today (local) midnight in ISO; query starts_at >= midnight today
      const todayMidnight = new Date(`${today}T00:00:00`)
      const { data } = await supabase
        .from('time_off')
        .select('id, starts_at, ends_at, reason')
        .eq('barber_id', barberId)
        .gte('starts_at', todayMidnight.toISOString())
        .order('starts_at')

      setRows((data as TimeOffRow[] | null) ?? [])
      setLoading(false)
    }
    fetch()
  }, [barberId, refreshKey, today])

  const refresh = () => setRefreshKey((k) => k + 1)

  const handleAdd = async () => {
    if (!newDate) return
    setAdding(true)
    // Build local-midnight timestamps for the chosen date
    const dayStart = new Date(`${newDate}T00:00:00`)
    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayEnd.getDate() + 1)

    await supabase.from('time_off').insert({
      barber_id: barberId,
      starts_at: dayStart.toISOString(),
      ends_at: dayEnd.toISOString(),
      reason: newReason.trim() || null,
      is_all_day: true,
    })

    setNewDate('')
    setNewReason('')
    setAdding(false)
    refresh()
  }

  const handleRemove = async (id: string) => {
    await supabase.from('time_off').delete().eq('id', id)
    setConfirmRemoveId(null)
    refresh()
  }

  if (loading) return <p className="text-xs text-gray-400 px-4 py-3">Henter fridage…</p>

  return (
    <div className="px-4 py-3 space-y-3">
      {/* List */}
      <div>
        {rows.length === 0 ? (
          <p className="text-xs text-gray-400">Ingen planlagte fridage.</p>
        ) : (
          <div className="space-y-1">
            {rows.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between border-b border-gray-100 last:border-0 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm text-gray-700">{formatDanishDate(row.starts_at)}</p>
                  {row.reason && <p className="text-xs text-gray-400 mt-0.5">{row.reason}</p>}
                </div>
                {confirmRemoveId === row.id ? (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-500">Er du sikker?</span>
                    <button
                      onClick={() => handleRemove(row.id)}
                      className="text-red-500 hover:text-red-600 font-medium"
                    >
                      Ja
                    </button>
                    <button
                      onClick={() => setConfirmRemoveId(null)}
                      className="text-gray-400 hover:text-gray-700"
                    >
                      Nej
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmRemoveId(row.id)}
                    className="text-red-500 hover:text-red-600 text-xs px-2 py-1"
                    aria-label="Fjern fridag"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add form */}
      <div className="border-t border-gray-100 pt-3 space-y-2">
        <p className="text-[11px] tracking-[0.08em] uppercase text-gray-400 font-medium">
          Tilføj fridag
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="date"
            min={today}
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="border border-gray-200 rounded-md px-2.5 py-1.5 text-xs text-gray-700 outline-none focus:border-[#B08A3E]"
          />
          <input
            type="text"
            value={newReason}
            onChange={(e) => setNewReason(e.target.value)}
            placeholder="Ferie, syg, andet…"
            className="flex-1 border border-gray-200 rounded-md px-2.5 py-1.5 text-xs text-gray-700 outline-none focus:border-[#B08A3E]"
          />
          <button
            onClick={handleAdd}
            disabled={!newDate || adding}
            className="px-3 py-1.5 bg-[#B08A3E] hover:bg-[#8C6A28] text-white text-xs font-medium rounded-md transition-colors disabled:opacity-50"
          >
            Tilføj
          </button>
        </div>
      </div>
    </div>
  )
}
