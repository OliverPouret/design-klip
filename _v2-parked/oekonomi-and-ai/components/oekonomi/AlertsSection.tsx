// Alert rules configured here are stored in `alert_rules`.
// Rule evaluation (writing to `alert_triggers`) is handled by a future scheduled
// Edge Function — out of scope for this UI. For now, rules can be configured
// but never fire.

import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

interface AlertRule {
  id: string
  metric: 'daily_revenue' | 'no_shows_week' | 'rebooking_rate' | 'occupancy'
  operator: 'lt' | 'gt'
  threshold: number
  is_active: boolean
  created_at: string
}

const METRIC_LABEL: Record<AlertRule['metric'], string> = {
  daily_revenue: 'Daglig omsætning',
  no_shows_week: 'Udeblivelser denne uge',
  rebooking_rate: 'Rebooking-rate',
  occupancy: 'Belægning',
}

const METRIC_UNIT: Record<AlertRule['metric'], string> = {
  daily_revenue: 'kr',
  no_shows_week: '',
  rebooking_rate: '%',
  occupancy: '%',
}

export function AlertsSection() {
  const [rules, setRules] = useState<AlertRule[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [draftMetric, setDraftMetric] = useState<AlertRule['metric']>('daily_revenue')
  const [draftOperator, setDraftOperator] = useState<AlertRule['operator']>('lt')
  const [draftThreshold, setDraftThreshold] = useState('')

  const refresh = async () => {
    const { data } = await supabase
      .from('alert_rules')
      .select('*')
      .order('created_at', { ascending: false })
    setRules((data ?? []) as AlertRule[])
    setLoading(false)
  }

  useEffect(() => {
    refresh()
  }, [])

  const addRule = async () => {
    const n = Number(draftThreshold)
    if (isNaN(n)) return
    const { error } = await supabase.from('alert_rules').insert({
      metric: draftMetric,
      operator: draftOperator,
      threshold: n,
      is_active: true,
    })
    if (!error) {
      setAdding(false)
      setDraftThreshold('')
      refresh()
    }
  }

  const toggleActive = async (rule: AlertRule) => {
    await supabase.from('alert_rules').update({ is_active: !rule.is_active }).eq('id', rule.id)
    refresh()
  }

  const deleteRule = async (id: string) => {
    await supabase.from('alert_rules').delete().eq('id', id)
    refresh()
  }

  return (
    <div>
      <h2 className="text-sm font-medium text-gray-900 mb-1">Advarsler</h2>
      <p className="text-xs text-gray-500 mb-3">Få besked når noget afviger fra det normale</p>
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        {loading ? (
          <p className="text-sm text-gray-400">Henter…</p>
        ) : rules.length === 0 ? (
          <p className="text-sm text-gray-500 italic">Ingen advarsler er konfigureret endnu.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {rules.map((r) => {
              const op = r.operator === 'lt' ? 'under' : 'over'
              const unit = METRIC_UNIT[r.metric]
              const label = `${METRIC_LABEL[r.metric]} ${op} ${r.threshold}${unit ? ' ' + unit : ''}`
              return (
                <li key={r.id} className="flex items-center gap-3 py-2.5">
                  <span className="text-sm text-gray-900 flex-1">{label}</span>
                  <button
                    type="button"
                    onClick={() => toggleActive(r)}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                      r.is_active
                        ? 'bg-[#10B981]/10 text-[#059669] border border-[#10B981]/30'
                        : 'bg-gray-100 text-gray-500 border border-gray-200'
                    }`}
                  >
                    {r.is_active ? 'Aktiv' : 'Inaktiv'}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteRule(r.id)}
                    className="text-[11px] text-gray-400 hover:text-[#EF4444] transition-colors"
                  >
                    Slet
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {adding ? (
          <div className="mt-4 border-t border-gray-100 pt-4 flex flex-wrap items-center gap-2">
            <select
              value={draftMetric}
              onChange={(e) => setDraftMetric(e.target.value as AlertRule['metric'])}
              className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-md bg-white text-gray-700 outline-none focus:border-[#B08A3E]"
            >
              <option value="daily_revenue">Daglig omsætning</option>
              <option value="no_shows_week">Udeblivelser denne uge</option>
              <option value="rebooking_rate">Rebooking-rate</option>
              <option value="occupancy">Belægning</option>
            </select>
            <select
              value={draftOperator}
              onChange={(e) => setDraftOperator(e.target.value as AlertRule['operator'])}
              className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-md bg-white text-gray-700 outline-none focus:border-[#B08A3E]"
            >
              <option value="lt">under</option>
              <option value="gt">over</option>
            </select>
            <input
              type="number"
              value={draftThreshold}
              onChange={(e) => setDraftThreshold(e.target.value)}
              placeholder="Værdi"
              className="w-24 px-2.5 py-1.5 text-xs border border-gray-200 rounded-md outline-none focus:border-[#B08A3E]"
            />
            <button
              type="button"
              onClick={addRule}
              className="px-3 py-1.5 text-xs font-medium bg-[#B08A3E] hover:bg-[#8C6A28] text-white rounded-md transition-colors"
            >
              Tilføj
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
            >
              Annullér
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-4 text-xs font-medium text-[#B08A3E] hover:text-[#8C6A28] transition-colors"
          >
            + Tilføj advarsel
          </button>
        )}
      </div>
    </div>
  )
}
