import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

interface TriggerWithRule {
  id: string
  rule_id: string
  triggered_at: string
  value_at_trigger: number
  rule: {
    metric: string
    operator: string
    threshold: number
  } | null
}

const METRIC_LABEL: Record<string, string> = {
  daily_revenue: 'Daglig omsætning',
  no_shows_week: 'Udeblivelser denne uge',
  rebooking_rate: 'Rebooking-rate',
  occupancy: 'Belægning',
}

export function AlertsBanner() {
  const [triggers, setTriggers] = useState<TriggerWithRule[]>([])

  const refresh = async () => {
    const { data } = await supabase
      .from('alert_triggers')
      .select('id, rule_id, triggered_at, value_at_trigger, rule:alert_rules(metric, operator, threshold)')
      .eq('acknowledged', false)
      .order('triggered_at', { ascending: false })
    setTriggers((data ?? []) as unknown as TriggerWithRule[])
  }

  useEffect(() => {
    refresh()
  }, [])

  if (triggers.length === 0) return null

  const acknowledgeAll = async () => {
    const ids = triggers.map((t) => t.id)
    await supabase.from('alert_triggers').update({ acknowledged: true }).in('id', ids)
    refresh()
  }

  return (
    <div className="bg-[#EF4444]/5 border border-[#EF4444]/20 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <span className="text-xl leading-none">⚠️</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#EF4444]">
            {triggers.length} {triggers.length === 1 ? 'advarsel kræver opmærksomhed' : 'advarsler kræver opmærksomhed'}
          </p>
          <ul className="text-xs text-gray-700 mt-1 space-y-0.5">
            {triggers.slice(0, 5).map((t) => {
              const m = t.rule ? METRIC_LABEL[t.rule.metric] ?? t.rule.metric : 'Ukendt regel'
              const op = t.rule?.operator === 'lt' ? 'faldt under' : 'oversteg'
              const thr = t.rule?.threshold ?? 0
              return (
                <li key={t.id}>
                  {m} {op} {thr} ({t.value_at_trigger})
                </li>
              )
            })}
            {triggers.length > 5 && <li className="text-gray-400">+ {triggers.length - 5} flere…</li>}
          </ul>
        </div>
        <button
          type="button"
          onClick={acknowledgeAll}
          className="text-xs font-medium text-[#EF4444] hover:underline whitespace-nowrap"
        >
          Bekræft alle
        </button>
      </div>
    </div>
  )
}
