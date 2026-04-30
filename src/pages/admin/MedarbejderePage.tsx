import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { BarberCard } from '../../components/admin/staff/BarberCard'

interface BarberRow {
  id: string
  display_name: string
  photo_url: string | null
  is_active: boolean
  display_order: number
}

export function MedarbejderePage() {
  const [barbers, setBarbers] = useState<BarberRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('barbers')
      .select('id, display_name, photo_url, is_active, display_order')
      .order('display_order')
      .then(({ data }) => {
        setBarbers((data as BarberRow[] | null) ?? [])
        setLoading(false)
      })
  }, [])

  return (
    <div className="md:h-full md:flex md:flex-col md:min-h-0 md:overflow-y-auto md:pr-1 space-y-4">
      <div className="flex-shrink-0">
        <h1 className="font-serif text-[22px] text-ink">Medarbejdere</h1>
        <p className="text-sm text-gray-500 mt-1">
          Administrér frisørernes arbejdstider og fridage
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Henter medarbejdere…</p>
      ) : barbers.length === 0 ? (
        <p className="text-sm text-gray-500">Ingen medarbejdere endnu.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {barbers.map((b) => (
            <BarberCard key={b.id} barber={b} />
          ))}
        </div>
      )}
    </div>
  )
}
