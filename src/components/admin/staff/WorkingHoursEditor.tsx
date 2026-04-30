import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

interface WorkingHoursEditorProps {
  barberId: string
}

interface DayRow {
  isoweekday: number
  is_working: boolean
  opens_at: string
  closes_at: string
}

const ISO_DAYS = [
  { iso: 1, label: 'Mandag' },
  { iso: 2, label: 'Tirsdag' },
  { iso: 3, label: 'Onsdag' },
  { iso: 4, label: 'Torsdag' },
  { iso: 5, label: 'Fredag' },
  { iso: 6, label: 'Lørdag' },
  { iso: 7, label: 'Søndag' },
]

const DEFAULT_ROWS: DayRow[] = ISO_DAYS.map(({ iso }) => ({
  isoweekday: iso,
  // Mon–Fri default open 09–17; Sat/Sun closed
  is_working: iso >= 1 && iso <= 5,
  opens_at: '09:00',
  closes_at: iso >= 1 && iso <= 5 ? '17:00' : '17:00',
}))

export function WorkingHoursEditor({ barberId }: WorkingHoursEditorProps) {
  const [rows, setRows] = useState<DayRow[]>(DEFAULT_ROWS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchHours = async () => {
      const { data } = await supabase
        .from('barber_hours')
        .select('isoweekday, opens_at, closes_at')
        .eq('barber_id', barberId)

      const existing = (data ?? []) as { isoweekday: number; opens_at: string | null; closes_at: string | null }[]
      const map = new Map(existing.map((r) => [r.isoweekday, r]))

      const merged: DayRow[] = ISO_DAYS.map(({ iso }) => {
        const row = map.get(iso)
        if (row && row.opens_at && row.closes_at) {
          return {
            isoweekday: iso,
            is_working: true,
            opens_at: row.opens_at.slice(0, 5),
            closes_at: row.closes_at.slice(0, 5),
          }
        }
        // No row OR opens/closes null → not working that day
        return {
          isoweekday: iso,
          is_working: false,
          opens_at: '09:00',
          closes_at: iso === 6 ? '14:00' : '17:00',
        }
      })

      setRows(merged)
      setLoading(false)
    }
    fetchHours()
  }, [barberId])

  const updateRow = (iso: number, patch: Partial<DayRow>) => {
    setRows((prev) => prev.map((r) => (r.isoweekday === iso ? { ...r, ...patch } : r)))
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSavedFlash(false)

    const upserts = rows.map((r) => ({
      barber_id: barberId,
      isoweekday: r.isoweekday,
      opens_at: r.is_working ? r.opens_at : null,
      closes_at: r.is_working ? r.closes_at : null,
    }))

    const { error: dbErr } = await supabase
      .from('barber_hours')
      .upsert(upserts, { onConflict: 'barber_id,isoweekday' })

    setSaving(false)

    if (dbErr) {
      setError('Kunne ikke gemme arbejdstider. Prøv igen.')
      return
    }

    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 2000)
  }

  if (loading) return <p className="text-xs text-gray-400 px-4 py-3">Henter arbejdstider…</p>

  return (
    <div className="px-4 py-3 space-y-2">
      <table className="w-full text-sm">
        <tbody>
          {rows.map((row) => {
            const dayLabel = ISO_DAYS.find((d) => d.iso === row.isoweekday)?.label ?? ''
            return (
              <tr key={row.isoweekday} className="border-b border-gray-100 last:border-0">
                <td className="py-2 pr-2 w-9">
                  <input
                    type="checkbox"
                    checked={row.is_working}
                    onChange={(e) => updateRow(row.isoweekday, { is_working: e.target.checked })}
                    className="w-4 h-4 accent-[#B08A3E]"
                  />
                </td>
                <td className="py-2 pr-3 w-24 text-gray-700">{dayLabel}</td>
                <td className="py-2 pr-2">
                  <input
                    type="time"
                    step={1800}
                    value={row.opens_at}
                    disabled={!row.is_working}
                    onChange={(e) => updateRow(row.isoweekday, { opens_at: e.target.value })}
                    className="border border-gray-200 rounded-md px-2 py-1 text-xs text-gray-700 disabled:bg-gray-50 disabled:text-gray-400 outline-none focus:border-[#B08A3E]"
                  />
                </td>
                <td className="py-2 pr-2 text-gray-400 text-xs">–</td>
                <td className="py-2">
                  <input
                    type="time"
                    step={1800}
                    value={row.closes_at}
                    disabled={!row.is_working}
                    onChange={(e) => updateRow(row.isoweekday, { closes_at: e.target.value })}
                    className="border border-gray-200 rounded-md px-2 py-1 text-xs text-gray-700 disabled:bg-gray-50 disabled:text-gray-400 outline-none focus:border-[#B08A3E]"
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="flex items-center justify-between pt-2">
        <div>
          {savedFlash && <span className="text-xs text-green-600">Gemt ✓</span>}
          {error && <span className="text-xs text-red-500">{error}</span>}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1.5 bg-[#B08A3E] hover:bg-[#8C6A28] text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? 'Gemmer…' : 'Gem arbejdstider'}
        </button>
      </div>
    </div>
  )
}
