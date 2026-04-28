import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Barber } from '../types/database'

export function useBarbers() {
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('barbers')
      .select('*')
      .eq('is_active', true)
      .order('display_order')
      .then(({ data }) => {
        if (data) setBarbers(data)
        setLoading(false)
      })
  }, [])

  return { barbers, loading }
}
