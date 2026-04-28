import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useSettings() {
  const [settings, setSettings] = useState<Record<string, unknown>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('settings')
      .select('key, value')
      .then(({ data }) => {
        if (data) {
          const map: Record<string, unknown> = {}
          data.forEach((s: { key: string; value: unknown }) => { map[s.key] = s.value })
          setSettings(map)
        }
        setLoading(false)
      })
  }, [])

  return { settings, loading }
}
