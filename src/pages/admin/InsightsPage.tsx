import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { MonthRangePicker } from '../../components/admin/MonthRangePicker'
import { BusinessOverview } from '../../components/admin/BusinessOverview'

interface OverviewRow {
  period_months: number
  summary_text: string
  generated_at: string
  stats_json: Record<string, unknown> | null
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

function monthsBetween(earliest: Date, today: Date): number {
  const years = today.getFullYear() - earliest.getFullYear()
  const months = today.getMonth() - earliest.getMonth()
  // Add 1 so a single-day-old shop still gets at least 1 month
  return Math.max(1, years * 12 + months + 1)
}

export function InsightsPage() {
  const [maxMonths, setMaxMonths] = useState(6)
  const [selectedMonths, setSelectedMonths] = useState(1)
  const [summary, setSummary] = useState<string | null>(null)
  const [stats, setStats] = useState<Record<string, unknown> | null>(null)
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)
  const [forceLoading, setForceLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch earliest booking on mount → derive maxMonths
  useEffect(() => {
    supabase
      .from('bookings')
      .select('starts_at')
      .order('starts_at', { ascending: true })
      .limit(1)
      .then(({ data }) => {
        const first = (data as { starts_at: string }[] | null)?.[0]
        if (first) {
          const m = monthsBetween(new Date(first.starts_at), new Date())
          setMaxMonths(Math.min(60, m))
        }
      })
  }, [])

  // Load (or generate) the overview when selectedMonths changes
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)

      const { data: cached } = await supabase
        .from('business_overviews')
        .select('*')
        .eq('period_months', selectedMonths)
        .maybeSingle()

      if (cancelled) return

      const cachedRow = cached as OverviewRow | null
      const isFresh =
        cachedRow && Date.now() - new Date(cachedRow.generated_at).getTime() < SEVEN_DAYS_MS

      if (cachedRow && isFresh) {
        setSummary(cachedRow.summary_text)
        setStats(cachedRow.stats_json)
        setGeneratedAt(new Date(cachedRow.generated_at))
        setLoading(false)
        return
      }

      // Show stale cache (if any) while regenerating
      if (cachedRow) {
        setSummary(cachedRow.summary_text)
        setStats(cachedRow.stats_json)
        setGeneratedAt(new Date(cachedRow.generated_at))
      } else {
        setSummary(null)
        setStats(null)
        setGeneratedAt(null)
      }

      const { data: fresh, error: fnErr } = await supabase.functions.invoke(
        'generate-business-overview',
        { body: { period_months: selectedMonths } },
      )
      if (cancelled) return
      if (fnErr) {
        setError('Kunne ikke generere oversigt. Prøv igen.')
        setLoading(false)
        return
      }
      const payload = fresh as
        | { summary_text?: string; stats_json?: Record<string, unknown>; generated_at?: string }
        | null
      if (payload?.summary_text) {
        setSummary(payload.summary_text)
        setStats(payload.stats_json ?? null)
        setGeneratedAt(payload.generated_at ? new Date(payload.generated_at) : new Date())
      }
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [selectedMonths])

  const handleForceRegenerate = async () => {
    setForceLoading(true)
    setError(null)
    const { data, error: fnErr } = await supabase.functions.invoke(
      'generate-business-overview',
      { body: { period_months: selectedMonths } },
    )
    setForceLoading(false)
    if (fnErr) {
      setError('Kunne ikke opdatere. Prøv igen.')
      return
    }
    const payload = data as
      | { summary_text?: string; stats_json?: Record<string, unknown>; generated_at?: string }
      | null
    if (payload?.summary_text) {
      setSummary(payload.summary_text)
      setStats(payload.stats_json ?? null)
      setGeneratedAt(payload.generated_at ? new Date(payload.generated_at) : new Date())
    }
  }

  return (
    <div className="md:h-full md:flex md:flex-col md:min-h-0 md:overflow-y-auto">
      <div className="max-w-3xl mx-auto w-full py-6 px-4 space-y-4">
        <div>
          <h1 className="font-serif text-2xl text-gray-900">Forretningsoverblik</h1>
          <p className="text-sm text-gray-500 leading-relaxed mt-1">
            AI-genereret oversigt over din forretning. Opdateres automatisk hver uge.
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <MonthRangePicker
            value={selectedMonths}
            max={maxMonths}
            onChange={setSelectedMonths}
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <BusinessOverview
          summary={summary}
          stats={stats as never}
          generatedAt={generatedAt}
          isLoading={loading}
          onForceRegenerate={handleForceRegenerate}
          forceLoading={forceLoading}
        />
      </div>
    </div>
  )
}
