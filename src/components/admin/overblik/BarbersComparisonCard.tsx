// Generic productivity-bar list. Used for both "Travleste barberer" and
// "Mest bookede services". Each row has an avatar (initials), label, optional
// sublabel, count + suffix, and a horizontal progress bar scaled to the
// max count in the list.

interface ComparisonItem {
  id: string
  label: string
  sublabel?: string
  count: number
  // Override the avatar background colour (e.g. barber profile_color).
  avatarColor?: string
}

interface BarbersComparisonCardProps {
  title: string
  items: ComparisonItem[]
  countSuffix?: string
  // Bar fill colour. Defaults to olive (success) for barbers; pass gold for
  // services if desired.
  barColor?: string
  loading?: boolean
  emptyText?: string
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function BarbersComparisonCard({
  title,
  items,
  countSuffix = 'bookinger',
  barColor = '#5C7A4A',
  loading = false,
  emptyText = 'Ingen data i denne periode.',
}: BarbersComparisonCardProps) {
  const max = Math.max(1, ...items.map((i) => i.count))

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <h3 className="font-serif text-[18px] text-ink mb-4 leading-tight">{title}</h3>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-[13px] text-gray-400">{emptyText}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const pct = Math.round((item.count / max) * 100)
            return (
              <li key={item.id} className="flex items-center gap-3">
                <div
                  className="h-8 w-8 flex-shrink-0 rounded-full flex items-center justify-center text-[12px] font-medium"
                  style={{
                    backgroundColor: '#FFF',
                    color: '#8C6A28',
                    boxShadow: `inset 0 0 0 2px ${item.avatarColor ?? '#B08A3E'}`,
                  }}
                  aria-hidden="true"
                >
                  {initials(item.label)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[13px] font-medium text-ink truncate">{item.label}</p>
                    <p className="text-[12px] text-gray-500 tabular-nums flex-shrink-0">
                      <span className="font-medium text-ink">{item.count}</span> {countSuffix}
                    </p>
                  </div>
                  {item.sublabel && (
                    <p className="text-[10px] tracking-[0.08em] uppercase text-gray-400 mt-0.5">
                      {item.sublabel}
                    </p>
                  )}
                  <div
                    className="h-1 rounded-full mt-1.5 overflow-hidden"
                    style={{ backgroundColor: '#F4F0E6' }}
                    aria-hidden="true"
                  >
                    <div
                      className="h-full rounded-full transition-[width] duration-300"
                      style={{ width: `${pct}%`, backgroundColor: barColor }}
                    />
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
