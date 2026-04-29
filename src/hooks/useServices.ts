import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Service } from '../types/database'

export function useServices() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('services')
      .select('*')
      .eq('is_active', true)
      .order('display_order')
      .then(({ data }) => {
        if (data) setServices(data)
        setLoading(false)
      })
  }, [])

  return { services, loading }
}
