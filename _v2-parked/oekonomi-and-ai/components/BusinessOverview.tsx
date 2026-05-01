interface StatsJson {
  total_bookings?: number
  total_revenue_kr?: number
  online_count?: number
  online_percent?: number
  phone_count?: number
  phone_percent?: number
  unique_customers?: number
  repeat_customers?: number
  busiest_weekday?: string
}

interface BusinessOverviewProps {
  summary: string | null
  stats: StatsJson | null
  generatedAt: Date | null
  isLoading: boolean
  onForceRegenerate: () => void
  forceLoading: boolean
}

const WEEKDAYS_DA: Record<string, string> = {
  monday: 'mandag',
  tuesday: 'tirsdag',
  wednesday: 'onsdag',
  thursday: 'torsdag',
  friday: 'fredag',
  saturday: 'lørdag',
  sunday: 'søndag',
}

function formatDanishDate(d: Date): string {
  const months = ['jan.', 'feb.', 'mar.', 'apr.', 'maj', 'jun.', 'jul.', 'aug.', 'sep.', 'okt.', 'nov.', 'dec.']
  return `${d.getDate()}. ${months[d.getMonth()]} ${d.getFullYear()}`
}

function renderSummary(text: string) {
  return text.split('\n').map((line, i) => {
    const isBold = /^\*\*(.+?)\*\*/.test(line)
    const cleaned = line.replace(/\*\*/g, '')
    return (
      <p
        key={i}
        className={`${
          isBold ? 'font-medium text-gray-900 mt-3 first:mt-0' : 'text-gray-600'
        } text-sm leading-relaxed`}
      >
        {cleaned}
      </p>
    )
  })
}

export function BusinessOverview({
  summary,
  stats,
  generatedAt,
  isLoading,
  onForceRegenerate,
  forceLoading,
}: BusinessOverviewProps) {
  if (isLoading && !summary) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="animate-pulse space-y-2">
          <div className="h-3 bg-gray-100 rounded w-3/4" />
          <div className="h-3 bg-gray-100 rounded w-full" />
          <div className="h-3 bg-gray-100 rounded w-5/6" />
          <div className="h-3 bg-gray-100 rounded w-2/3" />
        </div>
        <p className="text-xs text-gray-400 mt-4">Genererer oversigt…</p>
      </div>
    )
  }

  if (!summary) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
        <p className="text-sm text-gray-400">Ingen oversigt endnu.</p>
      </div>
    )
  }

  const pills: { label: string; value: string }[] = []
  if (stats?.total_bookings !== undefined)
    pills.push({ label: 'Bookinger', value: String(stats.total_bookings) })
  if (stats?.total_revenue_kr !== undefined)
    pills.push({ label: 'Omsætning', value: `${stats.total_revenue_kr} kr` })
  if (stats?.online_percent !== undefined)
    pills.push({ label: 'Online', value: `${stats.online_percent}%` })
  if (stats?.phone_percent !== undefined)
    pills.push({ label: 'Telefon', value: `${stats.phone_percent}%` })
  if (stats?.unique_customers !== undefined)
    pills.push({ label: 'Unikke kunder', value: String(stats.unique_customers) })
  if (stats?.busiest_weekday) {
    const wd = WEEKDAYS_DA[stats.busiest_weekday.toLowerCase()] ?? stats.busiest_weekday
    pills.push({ label: 'Travleste dag', value: wd })
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="border-l-2 border-[#B08A3E] pl-4">{renderSummary(summary)}</div>

      {pills.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-gray-100">
          {pills.map((p) => (
            <span
              key={p.label}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-50 border border-gray-200 text-xs"
            >
              <span className="text-gray-400">{p.label}</span>
              <span className="font-medium text-gray-900">{p.value}</span>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
        <p className="text-[11px] text-gray-400">
          {generatedAt ? `Sidst opdateret: ${formatDanishDate(generatedAt)}` : ''}
        </p>
        <button
          type="button"
          onClick={onForceRegenerate}
          disabled={forceLoading}
          className="text-[11px] text-[#B08A3E] hover:text-[#8C6A28] transition-colors disabled:opacity-50"
        >
          {forceLoading ? 'Opdaterer…' : 'Opdatér nu'}
        </button>
      </div>
    </div>
  )
}
